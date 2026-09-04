import express from "express";
import cors from "cors";
import { Pool } from "pg";
import crypto from "crypto";

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL
    ? { rejectUnauthorized: false }
    : undefined,
});

const CASE_STATUSES = [
  "OPEN",
  "DIAGNOSIS",
  "WAITING_APPROVAL",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "READY",
  "COMPLETED",
  "CLOSED",
];

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

const ROLES = [
  "OWNER",
  "EXECUTIVE",
  "TECHNICIAN",
];

const ROLE_LABELS: Record<string, string> = {
  OWNER: "مدیر اصلی",
  EXECUTIVE: "مدیر اجرایی",
  TECHNICIAN: "تکنسین",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "باز",
  DIAGNOSIS: "در حال عیب‌یابی",
  WAITING_APPROVAL: "در انتظار تأیید",
  IN_PROGRESS: "در حال تعمیر",
  WAITING_PARTS: "در انتظار قطعه",
  READY: "آماده تحویل",
  COMPLETED: "تکمیل شده",
  CLOSED: "بسته شده",
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeStatus(value: unknown) {
  return clean(value).toUpperCase();
}

function normalizePriority(value: unknown) {
  return clean(value || "NORMAL").toUpperCase();
}

function normalizeRole(value: unknown) {
  return clean(value).toUpperCase();
}

/* =========================
   SECURITY
========================= */

function hashPassword(password: string, salt?: string) {
  const actualSalt =
    salt ||
    crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .scryptSync(password, actualSalt, 64)
    .toString("hex");

  return {
    hash,
    salt: actualSalt,
  };
}

function verifyPassword(
  password: string,
  hash: string,
  salt: string
) {
  const derived = crypto.scryptSync(
    password,
    salt,
    64
  );

  const stored = Buffer.from(hash, "hex");

  return (
    stored.length === derived.length &&
    crypto.timingSafeEqual(stored, derived)
  );
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function getUserFromToken(
  token: string
) {
  if (!token) return null;

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.username,
      u.full_name,
      u.role,
      u.active
    FROM sessions s
    JOIN users u
      ON u.id = s.user_id
    WHERE s.token = $1
      AND s.expires_at > now()
      AND u.active = true
    `,
    [token]
  );

  return result.rows[0] || null;
}

async function authUser(
  req: express.Request
) {
  const header =
    clean(req.headers.authorization);

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  const token =
    header.substring(7).trim();

  return getUserFromToken(token);
}

function requireRoles(
  roles: string[]
) {
  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    try {
      const user = await authUser(req);

      if (!user) {
        return res.status(401).json({
          ok: false,
          message: "نیاز به ورود به سیستم دارید",
        });
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({
          ok: false,
          message: "شما اجازه انجام این عملیات را ندارید",
        });
      }

      (req as any).user = user;

      next();
    } catch (error) {
      console.error("AUTH ERROR:", error);

      return res.status(500).json({
        ok: false,
        message: "خطا در بررسی دسترسی",
      });
    }
  };
}

/* =========================
   AUTH TABLES
========================= */

async function ensureAuthTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username VARCHAR(100) UNIQUE NOT NULL,
      full_name VARCHAR(200) NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      role VARCHAR(30) NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_sessions_token
    ON sessions(token)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_role
    ON users(role)
  `);

  /*
   * جدول درخواست‌های عمومی مشتری
   */
  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(200) NOT NULL,
      phone VARCHAR(50) NOT NULL,
      motorcycle VARCHAR(200),
      service VARCHAR(200),
      description TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'NEW',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_requests_status
    ON customer_requests(status)
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_customer_requests_created_at
    ON customer_requests(created_at DESC)
  `);

  /*
   * اگر ADMIN_USERNAME و ADMIN_PASSWORD
   * در Environment تنظیم شده باشند،
   * مدیر اصلی به صورت خودکار ساخته می‌شود.
   */
  const adminUsername =
    clean(process.env.ADMIN_USERNAME);

  const adminPassword =
    clean(process.env.ADMIN_PASSWORD);

  if (adminUsername && adminPassword) {
    const existing =
      await pool.query(
        `
        SELECT id
        FROM users
        WHERE username = $1
        `,
        [adminUsername]
      );

    if (existing.rowCount === 0) {
      const { hash, salt } =
        hashPassword(adminPassword);

      await pool.query(
        `
        INSERT INTO users
          (
            username,
            full_name,
            password_hash,
            password_salt,
            role
          )
        VALUES
          ($1,$2,$3,$4,'OWNER')
        `,
        [
          adminUsername,
          "مدیر اصلی",
          hash,
          salt,
        ]
      );

      console.log(
        "[AUTH] Main owner created:",
        adminUsername
      );
    }
  }
}

/* =========================
   HEALTH
========================= */

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      service: "motoclinic-api",
      version: "0.8.0",
      database: "connected",
      authentication: "enabled",
      customerRequests: "enabled",
    });
  } catch (error) {
    console.error("HEALTH ERROR:", error);

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
    authentication: "enabled",
    customerRequests: "enabled",
  });
});

/* =========================
   LOGIN
========================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    const username =
      clean(req.body?.username);

    const password =
      clean(req.body?.password);

    if (!username || !password) {
      return res.status(400).json({
        ok: false,
        message: "نام کاربری و رمز عبور الزامی است",
      });
    }

    const result =
      await pool.query(
        `
        SELECT *
        FROM users
        WHERE username = $1
          AND active = true
        `,
        [username]
      );

    if (result.rowCount === 0) {
      return res.status(401).json({
        ok: false,
        message: "نام کاربری یا رمز عبور اشتباه است",
      });
    }

    const user = result.rows[0];

    const valid =
      verifyPassword(
        password,
        user.password_hash,
        user.password_salt
      );

    if (!valid) {
      return res.status(401).json({
        ok: false,
        message: "نام کاربری یا رمز عبور اشتباه است",
      });
    }

    const token = createToken();

    await pool.query(
      `
      INSERT INTO sessions
        (
          user_id,
          token,
          expires_at
        )
      VALUES
        (
          $1,
          $2,
          now() + interval '30 days'
        )
      `,
      [user.id, token]
    );

    res.json({
      ok: true,
      message: "ورود موفق بود",
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        role_label:
          ROLE_LABELS[user.role] ||
          user.role,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      ok: false,
      message: "خطا در ورود به سیستم",
    });
  }
});

/* =========================
   CURRENT USER
========================= */

app.get(
  "/api/auth/me",
  requireRoles(ROLES),
  async (req, res) => {
    res.json({
      ok: true,
      user: (req as any).user,
    });
  }
);

/* =========================
   LOGOUT
========================= */

app.post(
  "/api/auth/logout",
  async (req, res) => {
    try {
      const header =
        clean(req.headers.authorization);

      if (header.startsWith("Bearer ")) {
        const token =
          header.substring(7).trim();

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
        message: "خروج انجام شد",
      });
    } catch (error) {
      console.error("LOGOUT ERROR:", error);

      res.status(500).json({
        ok: false,
        message: "خطا در خروج",
      });
    }
  }
);

/* =========================
   USERS
   OWNER ONLY
========================= */

app.get(
  "/api/users",
  requireRoles(["OWNER"]),
  async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          id,
          username,
          full_name,
          role,
          active,
          created_at,
          updated_at
        FROM users
        ORDER BY created_at DESC
      `);

      res.json({
        ok: true,
        users: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message: "خطا در دریافت کاربران",
      });
    }
  }
);

app.post(
  "/api/users",
  requireRoles(["OWNER"]),
  async (req, res) => {
    try {
      const username =
        clean(req.body?.username);

      const fullName =
        clean(req.body?.full_name) ||
        clean(req.body?.fullName);

      const password =
        clean(req.body?.password);

      const role =
        normalizeRole(req.body?.role);

      if (
        !username ||
        !fullName ||
        !password ||
        !role
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "نام کاربری، نام کامل، رمز عبور و نقش الزامی است",
        });
      }

      if (!ROLES.includes(role)) {
        return res.status(400).json({
          ok: false,
          message: "نقش کاربر معتبر نیست",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          ok: false,
          message:
            "رمز عبور باید حداقل ۶ کاراکتر باشد",
        });
      }

      const duplicate =
        await pool.query(
          `
          SELECT id
          FROM users
          WHERE username = $1
          `,
          [username]
        );

      if (duplicate.rowCount > 0) {
        return res.status(409).json({
          ok: false,
          message: "این نام کاربری قبلاً ثبت شده است",
        });
      }

      const { hash, salt } =
        hashPassword(password);

      const result =
        await pool.query(
          `
          INSERT INTO users
            (
              username,
              full_name,
              password_hash,
              password_salt,
              role
            )
          VALUES
            ($1,$2,$3,$4,$5)
          RETURNING
            id,
            username,
            full_name,
            role,
            active,
            created_at
          `,
          [
            username,
            fullName,
            hash,
            salt,
            role,
          ]
        );

      res.status(201).json({
        ok: true,
        message: "کاربر با موفقیت ایجاد شد",
        user: result.rows[0],
      });
    } catch (error) {
      console.error("CREATE USER ERROR:", error);

      res.status(500).json({
        ok: false,
        message: "خطا در ایجاد کاربر",
      });
    }
  }
);

app.patch(
  "/api/users/:userId",
  requireRoles(["OWNER"]),
  async (req, res) => {
    try {
      const userId =
        clean(req.params.userId);

      const fullName =
        clean(req.body?.full_name) ||
        clean(req.body?.fullName);

      const role =
        normalizeRole(req.body?.role);

      const active =
        req.body?.active;

      if (
        role &&
        !ROLES.includes(role)
      ) {
        return res.status(400).json({
          ok: false,
          message: "نقش کاربر معتبر نیست",
        });
      }

      const result =
        await pool.query(
          `
          UPDATE users
          SET
            full_name =
              COALESCE(NULLIF($1,''), full_name),
            role =
              COALESCE(NULLIF($2,''), role),
            active =
              COALESCE($3, active),
            updated_at = now()
          WHERE id = $4
          RETURNING
            id,
            username,
            full_name,
            role,
            active,
            updated_at
          `,
          [
            fullName,
            role,
            typeof active === "boolean"
              ? active
              : null,
            userId,
          ]
        );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: "کاربر پیدا نشد",
        });
      }

      res.json({
        ok: true,
        message: "کاربر به‌روزرسانی شد",
        user: result.rows[0],
      });
    } catch (error) {
      console.error("UPDATE USER ERROR:", error);

      res.status(500).json({
        ok: false,
        message: "خطا در ویرایش کاربر",
      });
    }
  }
);

app.post(
  "/api/users/:userId/password",
  requireRoles(["OWNER"]),
  async (req, res) => {
    try {
      const userId =
        clean(req.params.userId);

      const password =
        clean(req.body?.password);

      if (password.length < 6) {
        return res.status(400).json({
          ok: false,
          message:
            "رمز عبور باید حداقل ۶ کاراکتر باشد",
        });
      }

      const { hash, salt } =
        hashPassword(password);

      const result =
        await pool.query(
          `
          UPDATE users
          SET
            password_hash = $1,
            password_salt = $2,
            updated_at = now()
          WHERE id = $3
          RETURNING id
          `,
          [
            hash,
            salt,
            userId,
          ]
        );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: "کاربر پیدا نشد",
        });
      }

      await pool.query(
        `
        DELETE FROM sessions
        WHERE user_id = $1
        `,
        [userId]
      );

      res.json({
        ok: true,
        message:
          "رمز عبور با موفقیت تغییر کرد",
      });
    } catch (error) {
      console.error(
        "PASSWORD ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        message:
          "خطا در تغییر رمز عبور",
      });
    }
  }
);

/* =========================
   DASHBOARD
========================= */

app.get("/api/dashboard", async (_req, res) => {
  try {
    const customers = await pool.query(
      "SELECT COUNT(*)::int AS count FROM customers"
    );

    const motorcycles = await pool.query(
      "SELECT COUNT(*)::int AS count FROM motorcycles"
    );

    const activeCases = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM service_cases
      WHERE status NOT IN ('COMPLETED', 'CLOSED')
    `);

    const revenue = await pool.query(`
      SELECT COALESCE(SUM(amount), 0)::numeric AS total
      FROM payments
    `);

    res.json({
      customers:
        customers.rows[0].count,
      motorcycles:
        motorcycles.rows[0].count,
      activeCases:
        activeCases.rows[0].count,
      revenue:
        Number(
          revenue.rows[0].total || 0
        ),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در دریافت داشبورد",
    });
  }
});

/* =========================
   CUSTOMERS
========================= */

app.get("/api/customers", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT *
      FROM customers
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در دریافت مشتریان",
    });
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    const name = clean(req.body?.name);
    const phone = clean(req.body?.phone);
    const address = clean(req.body?.address);
    const notes = clean(req.body?.notes);

    if (!name || !phone) {
      return res.status(400).json({
        ok: false,
        message: "نام و شماره تماس الزامی است",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO customers
        (name, phone, address, notes)
      VALUES
        ($1, $2, $3, $4)
      RETURNING *
      `,
      [
        name,
        phone,
        address || null,
        notes || null,
      ]
    );

    res.status(201).json({
      ok: true,
      message: "مشتری با موفقیت ثبت شد",
      customer: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در ثبت مشتری",
    });
  }
});

/* =========================
   MOTORCYCLES
========================= */

app.get("/api/motorcycles", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.*,
        c.name AS customer_name,
        c.phone AS customer_phone
      FROM motorcycles m
      JOIN customers c
        ON c.id = m.customer_id
      ORDER BY m.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در دریافت موتورسیکلت‌ها",
    });
  }
});

app.get(
  "/api/customers/:customerId/motorcycles",
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT *
        FROM motorcycles
        WHERE customer_id = $1
        ORDER BY created_at DESC
        `,
        [req.params.customerId]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message: "خطا در دریافت موتورسیکلت‌ها",
      });
    }
  }
);

app.post("/api/motorcycles", async (req, res) => {
  try {
    const customerId =
      req.body?.customer_id ||
      req.body?.customerId;

    const plate = clean(req.body?.plate);
    const brand = clean(req.body?.brand);
    const model = clean(req.body?.model);
    const color = clean(req.body?.color);
    const vin = clean(req.body?.vin);

    const year =
      req.body?.year
        ? Number(req.body.year)
        : null;

    const mileage =
      req.body?.mileage
        ? Number(req.body.mileage)
        : 0;

    if (!customerId || !plate) {
      return res.status(400).json({
        ok: false,
        message: "مشتری و پلاک الزامی است",
      });
    }

    const customer = await pool.query(
      "SELECT id FROM customers WHERE id = $1",
      [customerId]
    );

    if (customer.rowCount === 0) {
      return res.status(400).json({
        ok: false,
        message: "مشتری پیدا نشد",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO motorcycles
        (
          customer_id,
          plate,
          brand,
          model,
          year,
          color,
          vin,
          mileage
        )
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
      `,
      [
        customerId,
        plate,
        brand || null,
        model || null,
        year,
        color || null,
        vin || null,
        mileage,
      ]
    );

    res.status(201).json({
      ok: true,
      message: "موتورسیکلت با موفقیت ثبت شد",
      motorcycle: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در ثبت موتورسیکلت",
    });
  }
});

/* =========================
   CASES
========================= */

app.get("/api/cases", async (req, res) => {
  try {
    const code =
      clean(req.query?.code);

    if (code) {
      const result =
        await pool.query(
          `
          SELECT
            sc.*,
            c.name AS customer_name,
            c.phone AS customer_phone,
            m.plate AS motorcycle_plate,
            m.brand AS motorcycle_brand,
            m.model AS motorcycle_model
          FROM service_cases sc
          JOIN customers c
            ON c.id = sc.customer_id
          JOIN motorcycles m
            ON m.id = sc.motorcycle_id
          WHERE
            sc.id::text = $1
            OR sc.id::text ILIKE $1
          ORDER BY sc.created_at DESC
          LIMIT 1
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
        m.plate AS motorcycle_plate,
        m.brand AS motorcycle_brand,
        m.model AS motorcycle_model
      FROM service_cases sc
      JOIN customers c
        ON c.id = sc.customer_id
      JOIN motorcycles m
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
      message: "خطا در دریافت پرونده‌ها",
    });
  }
});

app.post("/api/cases", async (req, res) => {
  try {
    const customerId =
      req.body?.customer_id ||
      req.body?.customerId;

    const motorcycleId =
      req.body?.motorcycle_id ||
      req.body?.motorcycleId;

    const complaint =
      clean(req.body?.complaint);

    const diagnosis =
      clean(req.body?.diagnosis);

    const status =
      normalizeStatus(
        req.body?.status || "OPEN"
      );

    const priority =
      normalizePriority(
        req.body?.priority || "NORMAL"
      );

    if (
      !customerId ||
      !motorcycleId ||
      !complaint
    ) {
      return res.status(400).json({
        ok: false,
        message:
          "مشتری، موتورسیکلت و شرح مشکل الزامی است",
      });
    }

    if (!CASE_STATUSES.includes(status)) {
      return res.status(400).json({
        ok: false,
        message: "وضعیت نامعتبر است",
      });
    }

    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({
        ok: false,
        message: "اولویت نامعتبر است",
      });
    }

    const motorcycle =
      await pool.query(
        `
        SELECT id
        FROM motorcycles
        WHERE id = $1
          AND customer_id = $2
        `,
        [
          motorcycleId,
          customerId,
        ]
      );

    if (motorcycle.rowCount === 0) {
      return res.status(400).json({
        ok: false,
        message:
          "این موتورسیکلت متعلق به مشتری انتخاب‌شده نیست",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO service_cases
        (
          customer_id,
          motorcycle_id,
          complaint,
          diagnosis,
          status,
          priority
        )
      VALUES
        ($1,$2,$3,$4,$5,$6)
      RETURNING *
      `,
      [
        customerId,
        motorcycleId,
        complaint,
        diagnosis || null,
        status,
        priority,
      ]
    );

    res.status(201).json({
      ok: true,
      message: "پرونده با موفقیت ایجاد شد",
      case: result.rows[0],
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      message: "خطا در ایجاد پرونده",
    });
  }
});

app.get(
  "/api/cases/:caseId",
  async (req, res) => {
    try {
      const result =
        await pool.query(
          `
          SELECT
            sc.*,
            c.name AS customer_name,
            c.phone AS customer_phone,
            c.address AS customer_address,
            m.plate AS motorcycle_plate,
            m.brand AS motorcycle_brand,
            m.model AS motorcycle_model,
            m.year AS motorcycle_year,
            m.color AS motorcycle_color,
            m.mileage AS motorcycle_mileage
          FROM service_cases sc
          JOIN customers c
            ON c.id = sc.customer_id
          JOIN motorcycles m
            ON m.id = sc.motorcycle_id
          WHERE sc.id = $1
          `,
          [req.params.caseId]
        );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message: "پرونده پیدا نشد",
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
        message: "خطا در دریافت پرونده",
      });
    }
  }
);

/* =========================
   CHANGE CASE STATUS
========================= */

async function changeCaseStatus(
  req: express.Request,
  res: express.Response
) {
  try {
    const caseId =
      clean(req.params.caseId);

    const status =
      normalizeStatus(
        req.body?.status
      );

    if (!caseId) {
      return res.status(400).json({
        ok: false,
        message: "شناسه پرونده ارسال نشده است",
      });
    }

    if (!CASE_STATUSES.includes(status)) {
      return res.status(400).json({
        ok: false,
        message: "وضعیت انتخاب‌شده معتبر نیست",
        allowedStatuses: CASE_STATUSES,
      });
    }

    const existing =
      await pool.query(
        `
        SELECT id
        FROM service_cases
        WHERE id = $1
        `,
        [caseId]
      );

    if (existing.rowCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "پرونده پیدا نشد",
      });
    }

    const shouldClose =
      status === "COMPLETED" ||
      status === "CLOSED";

    const result =
      await pool.query(
        `
        UPDATE service_cases
        SET
          status = $1,
          closed_at =
            CASE
              WHEN $2 = true
                THEN COALESCE(closed_at, now())
              ELSE NULL
            END
        WHERE id = $3
        RETURNING *
        `,
        [
          status,
          shouldClose,
          caseId,
        ]
      );

    return res.json({
      ok: true,
      message:
        `وضعیت پرونده به «${STATUS_LABELS[status]}» تغییر کرد`,
      case: result.rows[0],
    });
  } catch (error) {
    console.error(
      "[STATUS ERROR]",
      error
    );

    return res.status(500).json({
      ok: false,
      message:
        "خطا در ذخیره وضعیت پرونده",
    });
  }
}

app.post(
  "/api/cases/:caseId/status",
  changeCaseStatus
);

app.patch(
  "/api/cases/:caseId/status",
  changeCaseStatus
);

/* =========================
   PUBLIC CUSTOMER REQUESTS
========================= */

/*
 * این endpoint عمومی است.
 * مشتری بدون ورود به پنل می‌تواند
 * درخواست سرویس ثبت کند.
 */

app.post(
  "/api/customer-requests",
  async (req, res) => {
    try {
      const name =
        clean(req.body?.name);

      const phone =
        clean(req.body?.phone);

      const motorcycle =
        clean(
          req.body?.motorcycle ||
          req.body?.motorcycle_name
        );

      const service =
        clean(
          req.body?.service ||
          req.body?.service_type
        );

      const description =
        clean(
          req.body?.description ||
          req.body?.message ||
          req.body?.notes
        );

      if (!name || !phone) {
        return res.status(400).json({
          ok: false,
          message:
            "نام و شماره تماس الزامی است",
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO customer_requests
            (
              name,
              phone,
              motorcycle,
              service,
              description
            )
          VALUES
            ($1,$2,$3,$4,$5)
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
        message:
          "درخواست سرویس با موفقیت ثبت شد",
        request: result.rows[0],
      });
    } catch (error) {
      console.error(
        "CUSTOMER REQUEST ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        message:
          "خطا در ثبت درخواست سرویس",
      });
    }
  }
);

/* =========================
   CUSTOMER REQUESTS
   MANAGEMENT
========================= */

app.get(
  "/api/customer-requests",
  requireRoles([
    "OWNER",
    "EXECUTIVE",
  ]),
  async (_req, res) => {
    try {
      const result =
        await pool.query(`
          SELECT
            id,
            name,
            phone,
            motorcycle,
            service,
            description,
            status,
            created_at,
            updated_at
          FROM customer_requests
          ORDER BY created_at DESC
        `);

      res.json({
        ok: true,
        requests: result.rows,
      });
    } catch (error) {
      console.error(
        "GET CUSTOMER REQUESTS ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت درخواست‌ها",
      });
    }
  }
);

app.get(
  "/api/customer-requests/:requestId",
  requireRoles([
    "OWNER",
    "EXECUTIVE",
  ]),
  async (req, res) => {
    try {
      const requestId =
        clean(req.params.requestId);

      const result =
        await pool.query(
          `
          SELECT *
          FROM customer_requests
          WHERE id = $1
          `,
          [requestId]
        );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message:
            "درخواست پیدا نشد",
        });
      }

      res.json({
        ok: true,
        request: result.rows[0],
      });
    } catch (error) {
      console.error(
        "GET CUSTOMER REQUEST ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت درخواست",
      });
    }
  }
);

app.patch(
  "/api/customer-requests/:requestId",
  requireRoles([
    "OWNER",
    "EXECUTIVE",
  ]),
  async (req, res) => {
    try {
      const requestId =
        clean(req.params.requestId);

      const status =
        clean(req.body?.status).toUpperCase();

      const allowedStatuses = [
        "NEW",
        "CONTACTED",
        "SCHEDULED",
        "CONVERTED",
        "CANCELLED",
        "CLOSED",
      ];

      if (
        !allowedStatuses.includes(status)
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "وضعیت درخواست معتبر نیست",
          allowedStatuses,
        });
      }

      const result =
        await pool.query(
          `
          UPDATE customer_requests
          SET
            status = $1,
            updated_at = now()
          WHERE id = $2
          RETURNING *
          `,
          [
            status,
            requestId,
          ]
        );

      if (result.rowCount === 0) {
        return res.status(404).json({
          ok: false,
          message:
            "درخواست پیدا نشد",
        });
      }

      res.json({
        ok: true,
        message:
          "وضعیت درخواست به‌روزرسانی شد",
        request: result.rows[0],
      });
    } catch (error) {
      console.error(
        "UPDATE CUSTOMER REQUEST ERROR:",
        error
      );

      res.status(500).json({
        ok: false,
        message:
          "خطا در به‌روزرسانی درخواست",
      });
    }
  }
);

/* =========================
   STARTUP
========================= */

async function start() {
  try {
    await pool.query("SELECT 1");
    await ensureAuthTables();

    console.log(
      "MotoClinic database/auth/customer requests ready"
    );

    app.listen(
      PORT,
      "0.0.0.0",
      () => {
        console.log(
          `MotoClinic API running on 0.0.0.0:${PORT}`
        );
      }
    );
  } catch (error) {
    console.error(
      "STARTUP ERROR:",
      error
    );

    process.exit(1);
  }
}

start();
