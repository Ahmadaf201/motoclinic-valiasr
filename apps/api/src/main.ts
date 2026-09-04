import express from "express";
import cors from "cors";
import { Pool } from "pg";
import crypto from "crypto";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 4000);

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL is not set.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

type UserRole = "OWNER" | "EXECUTIVE" | "TECHNICIAN" | "RECEPTION";

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

async function ensureAuthTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'OWNER',
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      token TEXT UNIQUE NOT NULL,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_token
    ON sessions(token);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      motorcycle TEXT,
      service TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'NEW',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_requests_status
    ON customer_requests(status);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_requests_created_at
    ON customer_requests(created_at DESC);
  `);
}

async function getUserFromToken(token: string | undefined) {
  if (!token) return null;

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.username,
      u.role,
      u.active
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = $1
      AND s.expires_at > NOW()
      AND u.active = TRUE
    LIMIT 1
    `,
    [token]
  );

  return result.rows[0] || null;
}

function getToken(req: express.Request): string | undefined {
  const auth = normalize(req.headers.authorization);

  if (!auth) return undefined;

  if (auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }

  return auth;
}

async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  try {
    const user = await getUserFromToken(getToken(req));

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "احراز هویت نامعتبر یا منقضی شده است.",
      });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "خطا در احراز هویت.",
    });
  }
}

function requireRoles(...roles: UserRole[]) {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const user = (req as any).user;

    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({
        ok: false,
        message: "دسترسی غیرمجاز.",
      });
    }

    next();
  };
}

/* =========================
   HEALTH
========================= */

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      service: "motoclinic-api",
      version: "0.8.0",
      database: "connected",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      service: "motoclinic-api",
      version: "0.8.0",
      database: "error",
    });
  }
});

app.get("/api", (_req, res) => {
  res.json({
    ok: true,
    service: "motoclinic-api",
    version: "0.8.0",
  });
});

/* =========================
   LOGIN
========================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = normalize(req.body?.username);
    const password = normalize(req.body?.password);

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        message: "نام کاربری و رمز عبور الزامی است.",
      });
    }

    const userResult = await pool.query(
      `
      SELECT
        id,
        username,
        password_hash,
        role,
        active
      FROM users
      WHERE LOWER(username) = LOWER($1)
      LIMIT 1
      `,
      [username]
    );

    const user = userResult.rows[0];

    if (!user || !user.active) {
      return res.status(401).json({
        ok: false,
        message: "نام کاربری یا رمز عبور اشتباه است.",
      });
    }

    /*
      پشتیبانی از رمزهای ساده فعلی پروژه.
      اگر password_hash به صورت bcrypt باشد،
      بخش مربوط به bcrypt در نسخه‌های بعدی اضافه خواهد شد.
    */

    if (password !== user.password_hash) {
      return res.status(401).json({
        ok: false,
        message: "نام کاربری یا رمز عبور اشتباه است.",
      });
    }

    const token = randomToken();

    await pool.query(
      `
      INSERT INTO sessions (
        token,
        user_id,
        expires_at
      )
      VALUES (
        $1,
        $2,
        NOW() + INTERVAL '7 days'
      )
      `,
      [token, user.id]
    );

    return res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      message: "خطا در ورود.",
    });
  }
});

/* =========================
   CURRENT USER
========================= */

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = (req as any).user;

  res.json({
    ok: true,
    user,
  });
});

/* =========================
   LOGOUT
========================= */

app.post("/api/auth/logout", requireAuth, async (req, res) => {
  try {
    const token = getToken(req);

    if (token) {
      await pool.query(
        `
        DELETE FROM sessions
        WHERE token = $1
        `,
        [token]
      );
    }

    res.json({
      ok: true,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در خروج.",
    });
  }
});

/* =========================
   DASHBOARD
========================= */

app.get(
  "/api/dashboard",
  requireAuth,
  requireRoles("OWNER", "EXECUTIVE", "RECEPTION", "TECHNICIAN"),
  async (_req, res) => {
    try {
      const [customers, motorcycles, cases, requests] =
        await Promise.all([
          pool.query(`SELECT COUNT(*)::int AS count FROM customers`),
          pool.query(`SELECT COUNT(*)::int AS count FROM motorcycles`),
          pool.query(`SELECT COUNT(*)::int AS count FROM service_cases`),
          pool.query(
            `SELECT COUNT(*)::int AS count
             FROM customer_requests
             WHERE status = 'NEW'`
          ),
        ]);

      res.json({
        ok: true,
        dashboard: {
          customers: customers.rows[0]?.count || 0,
          motorcycles: motorcycles.rows[0]?.count || 0,
          cases: cases.rows[0]?.count || 0,
          newRequests: requests.rows[0]?.count || 0,
        },
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message: "خطا در دریافت داشبورد.",
      });
    }
  }
);

/* =========================
   CUSTOMERS
========================= */

app.get("/api/customers", requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM customers
      ORDER BY created_at DESC
    `);

    res.json({
      ok: true,
      customers: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در دریافت مشتریان.",
    });
  }
});

app.post("/api/customers", requireAuth, async (req, res) => {
  try {
    const name = normalize(req.body?.name);
    const phone = normalize(req.body?.phone);

    if (!name || !phone) {
      return res.status(400).json({
        ok: false,
        message: "نام و شماره تماس الزامی است.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO customers (
        name,
        phone
      )
      VALUES ($1, $2)
      RETURNING *
      `,
      [name, phone]
    );

    res.status(201).json({
      ok: true,
      customer: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در ثبت مشتری.",
    });
  }
});

/* =========================
   MOTORCYCLES
========================= */

app.get("/api/motorcycles", requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM motorcycles
      ORDER BY created_at DESC
    `);

    res.json({
      ok: true,
      motorcycles: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در دریافت موتورسیکلت‌ها.",
    });
  }
});

app.post("/api/motorcycles", requireAuth, async (req, res) => {
  try {
    const customerId = normalize(req.body?.customer_id);
    const brand = normalize(req.body?.brand);
    const model = normalize(req.body?.model);
    const plate = normalize(req.body?.plate);

    if (!customerId || !brand || !model) {
      return res.status(400).json({
        ok: false,
        message: "مشتری، برند و مدل الزامی هستند.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO motorcycles (
        customer_id,
        brand,
        model,
        plate
      )
      VALUES ($1, $2, $3, $4)
      RETURNING *
      `,
      [customerId, brand, model, plate || null]
    );

    res.status(201).json({
      ok: true,
      motorcycle: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در ثبت موتورسیکلت.",
    });
  }
});

/* =========================
   SERVICE CASES
========================= */

app.get("/api/cases", async (req, res) => {
  try {
    const code = normalize(req.query?.code);

    if (code) {
      const result = await pool.query(
        `
        SELECT
          sc.*,
          c.name AS customer_name,
          c.phone AS customer_phone,
          m.brand AS motorcycle_brand,
          m.model AS motorcycle_model,
          m.plate AS motorcycle_plate
        FROM service_cases sc
        LEFT JOIN customers c
          ON c.id = sc.customer_id
        LEFT JOIN motorcycles m
          ON m.id = sc.motorcycle_id
        WHERE
          sc.code = $1
          OR sc.case_code = $1
          OR sc.id::text = $1
        ORDER BY sc.created_at DESC
        `,
        [code]
      );

      return res.json({
        ok: true,
        cases: result.rows,
        case: result.rows[0] || null,
      });
    }

    const result = await pool.query(`
      SELECT
        sc.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        m.brand AS motorcycle_brand,
        m.model AS motorcycle_model,
        m.plate AS motorcycle_plate
      FROM service_cases sc
      LEFT JOIN customers c
        ON c.id = sc.customer_id
      LEFT JOIN motorcycles m
        ON m.id = sc.motorcycle_id
      ORDER BY sc.created_at DESC
    `);

    res.json({
      ok: true,
      cases: result.rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در دریافت پرونده‌ها.",
    });
  }
});

/* =========================
   CASE BY ID
========================= */

app.get("/api/cases/:id", async (req, res) => {
  try {
    const id = normalize(req.params.id);

    const result = await pool.query(
      `
      SELECT
        sc.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        m.brand AS motorcycle_brand,
        m.model AS motorcycle_model,
        m.plate AS motorcycle_plate
      FROM service_cases sc
      LEFT JOIN customers c
        ON c.id = sc.customer_id
      LEFT JOIN motorcycles m
        ON m.id = sc.motorcycle_id
      WHERE
        sc.id::text = $1
        OR sc.code = $1
        OR sc.case_code = $1
      LIMIT 1
      `,
      [id]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        ok: false,
        message: "پرونده پیدا نشد.",
      });
    }

    res.json({
      ok: true,
      case: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در دریافت پرونده.",
    });
  }
});

/* =========================
   CREATE SERVICE CASE
========================= */

app.post(
  "/api/cases",
  requireAuth,
  async (req, res) => {
    try {
      const customerId = normalize(req.body?.customer_id);
      const motorcycleId = normalize(req.body?.motorcycle_id);
      const description = normalize(req.body?.description);
      const status = normalize(req.body?.status) || "RECEIVED";

      if (!customerId || !motorcycleId) {
        return res.status(400).json({
          ok: false,
          message: "مشتری و موتورسیکلت الزامی هستند.",
        });
      }

      const code =
        normalize(req.body?.code) ||
        `MC-${Date.now().toString().slice(-8)}`;

      const result = await pool.query(
        `
        INSERT INTO service_cases (
          customer_id,
          motorcycle_id,
          code,
          status,
          description
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          customerId,
          motorcycleId,
          code,
          status,
          description || null,
        ]
      );

      res.status(201).json({
        ok: true,
        case: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message: "خطا در ایجاد پرونده.",
      });
    }
  }
);

/* =========================
   UPDATE CASE STATUS
========================= */

app.patch(
  "/api/cases/:id/status",
  requireAuth,
  async (req, res) => {
    try {
      const id = normalize(req.params.id);
      const status = normalize(req.body?.status);

      if (!status) {
        return res.status(400).json({
          ok: false,
          message: "وضعیت جدید الزامی است.",
        });
      }

      const result = await pool.query(
        `
        UPDATE service_cases
        SET
          status = $1,
          updated_at = NOW()
        WHERE
          id::text = $2
          OR code = $2
          OR case_code = $2
        RETURNING *
        `,
        [status, id]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          message: "پرونده پیدا نشد.",
        });
      }

      res.json({
        ok: true,
        case: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message: "خطا در تغییر وضعیت پرونده.",
      });
    }
  }
);

/* =========================
   PUBLIC CUSTOMER REQUEST
========================= */

app.post("/api/customer-requests", async (req, res) => {
  try {
    const name = normalize(req.body?.name);
    const phone = normalize(req.body?.phone);
    const motorcycle = normalize(req.body?.motorcycle);
    const service = normalize(req.body?.service);
    const description = normalize(req.body?.description);

    if (!name || !phone) {
      return res.status(400).json({
        ok: false,
        message: "نام و شماره تماس الزامی است.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO customer_requests (
        name,
        phone,
        motorcycle,
        service,
        description,
        status
      )
      VALUES ($1, $2, $3, $4, $5, 'NEW')
      RETURNING
        id,
        name,
        phone,
        motorcycle,
        service,
        description,
        status,
        created_at
      `,
      [
        name,
        phone,
        motorcycle || null,
        service || null,
        description || null,
      ]
    );

    res.status(201).json({
      ok: true,
      message: "درخواست شما با موفقیت ثبت شد.",
      request: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "ثبت درخواست با خطا مواجه شد.",
    });
  }
});

/* =========================
   CUSTOMER REQUESTS - ADMIN
========================= */

app.get(
  "/api/customer-requests",
  requireAuth,
  requireRoles("OWNER", "EXECUTIVE"),
  async (req, res) => {
    try {
      const status = normalize(req.query?.status);

      const result = status
        ? await pool.query(
            `
            SELECT *
            FROM customer_requests
            WHERE status = $1
            ORDER BY created_at DESC
            `,
            [status]
          )
        : await pool.query(`
            SELECT *
            FROM customer_requests
            ORDER BY created_at DESC
          `);

      res.json({
        ok: true,
        requests: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message: "خطا در دریافت درخواست‌های مشتریان.",
      });
    }
  }
);

/* =========================
   CUSTOMER REQUEST BY ID
========================= */

app.get(
  "/api/customer-requests/:requestId",
  requireAuth,
  requireRoles("OWNER", "EXECUTIVE"),
  async (req, res) => {
    try {
      const requestId = normalize(req.params.requestId);

      const result = await pool.query(
        `
        SELECT *
        FROM customer_requests
        WHERE id::text = $1
        LIMIT 1
        `,
        [requestId]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          message: "درخواست پیدا نشد.",
        });
      }

      res.json({
        ok: true,
        request: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message: "خطا در دریافت درخواست.",
      });
    }
  }
);

/* =========================
   UPDATE CUSTOMER REQUEST
========================= */

app.patch(
  "/api/customer-requests/:requestId",
  requireAuth,
  requireRoles("OWNER", "EXECUTIVE"),
  async (req, res) => {
    try {
      const requestId = normalize(req.params.requestId);
      const status = normalize(req.body?.status);

      if (!status) {
        return res.status(400).json({
          ok: false,
          message: "وضعیت درخواست الزامی است.",
        });
      }

      const result = await pool.query(
        `
        UPDATE customer_requests
        SET
          status = $1,
          updated_at = NOW()
        WHERE id::text = $2
        RETURNING *
        `,
        [status, requestId]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          message: "درخواست پیدا نشد.",
        });
      }

      res.json({
        ok: true,
        request: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message: "خطا در تغییر وضعیت درخواست.",
      });
    }
  }
);

/* =========================
   404
========================= */

app.use((_req, res) => {
  res.status(404).json({
    ok: false,
    message: "مسیر مورد نظر پیدا نشد.",
  });
});

/* =========================
   START
========================= */

async function start() {
  try {
    await ensureAuthTables();

    await pool.query("SELECT 1");

    app.listen(PORT, () => {
      console.log(
        `MotoClinic API v0.8.0 running on port ${PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to start MotoClinic API:", error);
    process.exit(1);
  }
}

start();
