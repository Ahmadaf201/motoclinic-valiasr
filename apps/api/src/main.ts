import express from "express";
import cors from "cors";
import { Pool } from "pg";
import crypto from "crypto";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

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

type UserRole =
  | "OWNER"
  | "EXECUTIVE"
  | "TECHNICIAN"
  | "RECEPTION";

const CASE_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING_APPROVAL",
  "APPROVED",
  "REPAIRING",
  "READY_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

const TASK_STATUSES = [
  "TODO",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
] as const;

const ESTIMATE_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
] as const;

function normalize(value: unknown): string {
  return String(value ?? "").trim();
}

function numberValue(
  value: unknown,
  fallback = 0
): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function positiveNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function randomToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function generateCaseCode(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto
    .randomBytes(3)
    .toString("hex")
    .toUpperCase();

  return `MC-${timestamp}-${random}`;
}

/* =========================================================
   PASSWORD SECURITY
========================================================= */

function createPasswordHash(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");

  return {
    hash,
    salt,
  };
}

function verifyPassword(
  password: string,
  storedHash: string,
  salt: string | null | undefined
): boolean {
  if (!salt) {
    return password === storedHash;
  }

  try {
    const derived = crypto.scryptSync(
      password,
      salt,
      64
    );

    const stored = Buffer.from(storedHash, "hex");

    if (stored.length !== derived.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      stored,
      derived
    );
  } catch {
    return false;
  }
}

/* =========================================================
   AUTH TABLES
========================================================= */

async function ensureAuthTables() {
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
  `);

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
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS password_salt TEXT;
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
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
    CREATE INDEX IF NOT EXISTS idx_sessions_user
    ON sessions(user_id);
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

/* =========================================================
   SAFE OPERATIONAL MIGRATIONS
========================================================= */

async function ensureOperationalTables() {
  /*
   * These additions are intentionally non-destructive.
   * Existing data is preserved.
   */

  await pool.query(`
    ALTER TABLE service_cases
    ADD COLUMN IF NOT EXISTS case_code VARCHAR(60);
  `);

  await pool.query(`
    ALTER TABLE service_cases
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
    NOT NULL DEFAULT NOW();
  `);

  await pool.query(`
    ALTER TABLE service_cases
    ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;
  `);

  await pool.query(`
    ALTER TABLE service_cases
    ADD COLUMN IF NOT EXISTS delivered_by UUID;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS
    idx_service_cases_case_code
    ON service_cases(case_code)
    WHERE case_code IS NOT NULL;
  `);

  await pool.query(`
    UPDATE service_cases
    SET
      case_code =
        'MC-' ||
        UPPER(SUBSTRING(REPLACE(id::text, '-', '') FROM 1 FOR 10)),
      updated_at = COALESCE(updated_at, created_at, NOW())
    WHERE case_code IS NULL;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS case_history (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      case_id UUID NOT NULL
        REFERENCES service_cases(id)
        ON DELETE CASCADE,
      action VARCHAR(80) NOT NULL,
      from_status VARCHAR(40),
      to_status VARCHAR(40),
      note TEXT,
      actor_user_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_case_history_case
    ON case_history(case_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_case_history_created
    ON case_history(created_at DESC);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_case_parts_case
    ON case_parts(case_id);
  `);
}

/* =========================================================
   ADMIN USER
========================================================= */

async function ensureAdminUser() {
  const username = "Motoclinic";
  const password = normalize(
    process.env.ADMIN_PASSWORD
  );

  if (!password) {
    throw new Error(
      "ADMIN_PASSWORD is not set. Please add ADMIN_PASSWORD in Render Environment Variables."
    );
  }

  const existing = await pool.query(
    `
    SELECT
      id,
      password_hash,
      password_salt
    FROM users
    WHERE LOWER(username) = LOWER($1)
    LIMIT 1
    `,
    [username]
  );

  const secured = createPasswordHash(password);

  if (existing.rows[0]) {
    await pool.query(
      `
      UPDATE users
      SET
        password_hash = $1,
        password_salt = $2,
        role = 'OWNER',
        active = TRUE,
        updated_at = NOW()
      WHERE id = $3
      `,
      [
        secured.hash,
        secured.salt,
        existing.rows[0].id,
      ]
    );

    console.log(
      "MotoClinic admin user secured and updated."
    );

    return;
  }

  await pool.query(
    `
    INSERT INTO users (
      username,
      password_hash,
      password_salt,
      role,
      active
    )
    VALUES ($1, $2, $3, 'OWNER', TRUE)
    `,
    [
      username,
      secured.hash,
      secured.salt,
    ]
  );

  console.log(
    "MotoClinic admin user created."
  );
}

/* =========================================================
   AUTH HELPERS
========================================================= */

async function getUserFromToken(
  token: string | undefined
) {
  if (!token) return null;

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.username,
      u.role,
      u.active
    FROM sessions s
    JOIN users u
      ON u.id = s.user_id
    WHERE
      s.token = $1
      AND s.expires_at > NOW()
      AND u.active = TRUE
    LIMIT 1
    `,
    [token]
  );

  return result.rows[0] || null;
}

function getToken(
  req: express.Request
): string | undefined {
  const auth = normalize(
    req.headers.authorization
  );

  if (!auth) return undefined;

  if (
    auth.toLowerCase().startsWith("bearer ")
  ) {
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
    const user = await getUserFromToken(
      getToken(req)
    );

    if (!user) {
      return res.status(401).json({
        ok: false,
        message:
          "احراز هویت نامعتبر یا منقضی شده است.",
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

function requireRoles(
  ...roles: UserRole[]
) {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const user = (req as any).user;

    if (
      !user ||
      !roles.includes(user.role)
    ) {
      return res.status(403).json({
        ok: false,
        message: "دسترسی غیرمجاز.",
      });
    }

    next();
  };
}

/* =========================================================
   HEALTH
========================================================= */

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      service: "motoclinic-api",
      version: "1.0.0",
      database: "connected",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      service: "motoclinic-api",
      version: "1.0.0",
      database: "error",
    });
  }
});

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      service: "motoclinic-api",
      version: "1.0.0",
      database: "connected",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      service: "motoclinic-api",
      version: "1.0.0",
      database: "error",
    });
  }
});

app.get("/api", (_req, res) => {
  res.json({
    ok: true,
    service: "motoclinic-api",
    version: "1.0.0",
  });
});

/* =========================================================
   LOGIN
========================================================= */

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const username = normalize(
        req.body?.username
      );

      const password = normalize(
        req.body?.password
      );

      if (!username || !password) {
        return res.status(400).json({
          ok: false,
          message:
            "نام کاربری و رمز عبور الزامی است.",
        });
      }

      const result = await pool.query(
        `
        SELECT
          id,
          username,
          password_hash,
          password_salt,
          role,
          active
        FROM users
        WHERE LOWER(username) = LOWER($1)
        LIMIT 1
        `,
        [username]
      );

      const user = result.rows[0];

      if (!user || !user.active) {
        return res.status(401).json({
          ok: false,
          message:
            "نام کاربری یا رمز عبور اشتباه است.",
        });
      }

      const valid = verifyPassword(
        password,
        user.password_hash,
        user.password_salt
      );

      if (!valid) {
        return res.status(401).json({
          ok: false,
          message:
            "نام کاربری یا رمز عبور اشتباه است.",
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
  }
);

/* =========================================================
   CURRENT USER
========================================================= */

app.get(
  "/api/auth/me",
  requireAuth,
  async (req, res) => {
    res.json({
      ok: true,
      user: (req as any).user,
    });
  }
);

/* =========================================================
   LOGOUT
========================================================= */

app.post(
  "/api/auth/logout",
  requireAuth,
  async (req, res) => {
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
  }
);

/* =========================================================
   DASHBOARD
========================================================= */

app.get(
  "/api/dashboard",
  requireAuth,
  requireRoles(
    "OWNER",
    "EXECUTIVE",
    "RECEPTION",
    "TECHNICIAN"
  ),
  async (_req, res) => {
    try {
      const [
        customers,
        motorcycles,
        cases,
        requests,
        activeCases,
        waitingApproval,
        readyForDelivery,
        delivered,
        unpaid,
      ] = await Promise.all([
        pool.query(`
          SELECT COUNT(*)::int AS count
          FROM customers
        `),

        pool.query(`
          SELECT COUNT(*)::int AS count
          FROM motorcycles
        `),

        pool.query(`
          SELECT COUNT(*)::int AS count
          FROM service_cases
        `),

        pool.query(`
          SELECT COUNT(*)::int AS count
          FROM customer_requests
          WHERE status = 'NEW'
        `),

        pool.query(`
          SELECT COUNT(*)::int AS count
          FROM service_cases
          WHERE status IN (
            'OPEN',
            'IN_PROGRESS',
            'APPROVED',
            'REPAIRING'
          )
        `),

        pool.query(`
          SELECT COUNT(*)::int AS count
          FROM service_cases
          WHERE status = 'WAITING_APPROVAL'
        `),

        pool.query(`
          SELECT COUNT(*)::int AS count
          FROM service_cases
          WHERE status = 'READY_FOR_DELIVERY'
        `),

        pool.query(`
          SELECT COUNT(*)::int AS count
          FROM service_cases
          WHERE status = 'DELIVERED'
        `),

        pool.query(`
          SELECT
            COALESCE(SUM(
              GREATEST(
                e.total - COALESCE(p.paid, 0),
                0
              )
            ), 0)::numeric AS balance
          FROM estimates e
          LEFT JOIN (
            SELECT
              case_id,
              SUM(amount) AS paid
            FROM payments
            GROUP BY case_id
          ) p
            ON p.case_id = e.case_id
          WHERE e.status = 'APPROVED'
        `),
      ]);

      res.json({
        ok: true,
        dashboard: {
          customers:
            customers.rows[0]?.count || 0,

          motorcycles:
            motorcycles.rows[0]?.count || 0,

          cases:
            cases.rows[0]?.count || 0,

          newRequests:
            requests.rows[0]?.count || 0,

          activeCases:
            activeCases.rows[0]?.count || 0,

          waitingApproval:
            waitingApproval.rows[0]?.count || 0,

          readyForDelivery:
            readyForDelivery.rows[0]?.count || 0,

          delivered:
            delivered.rows[0]?.count || 0,

          unpaidBalance:
            Number(
              unpaid.rows[0]?.balance || 0
            ),
        },
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت داشبورد.",
      });
    }
  }
);

/* =========================================================
   CUSTOMERS
========================================================= */

app.get(
  "/api/customers",
  requireAuth,
  async (_req, res) => {
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
        message:
          "خطا در دریافت مشتریان.",
      });
    }
  }
);

app.get(
  "/api/customers/:id",
  requireAuth,
  async (req, res) => {
    try {
      const id = normalize(
        req.params.id
      );

      const customer =
        await pool.query(
          `
          SELECT *
          FROM customers
          WHERE id::text = $1
          LIMIT 1
          `,
          [id]
        );

      if (!customer.rows[0]) {
        return res.status(404).json({
          ok: false,
          message:
            "مشتری پیدا نشد.",
        });
      }

      const motorcycles =
        await pool.query(
          `
          SELECT *
          FROM motorcycles
          WHERE customer_id = $1
          ORDER BY created_at DESC
          `,
          [customer.rows[0].id]
        );

      res.json({
        ok: true,
        customer: customer.rows[0],
        motorcycles:
          motorcycles.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت مشتری.",
      });
    }
  }
);

app.post(
  "/api/customers",
  requireAuth,
  async (req, res) => {
    try {
      const name = normalize(
        req.body?.name
      );

      const phone = normalize(
        req.body?.phone
      );

      const address = normalize(
        req.body?.address
      );

      const notes = normalize(
        req.body?.notes
      );

      if (!name || !phone) {
        return res.status(400).json({
          ok: false,
          message:
            "نام و شماره تماس الزامی است.",
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO customers (
            name,
            phone,
            address,
            notes
          )
          VALUES ($1, $2, $3, $4)
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
        customer:
          result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ثبت مشتری.",
      });
    }
  }
);

app.patch(
  "/api/customers/:id",
  requireAuth,
  async (req, res) => {
    try {
      const id = normalize(
        req.params.id
      );

      const name = normalize(
        req.body?.name
      );

      const phone = normalize(
        req.body?.phone
      );

      const address = normalize(
        req.body?.address
      );

      const notes = normalize(
        req.body?.notes
      );

      if (!name || !phone) {
        return res.status(400).json({
          ok: false,
          message:
            "نام و شماره تماس الزامی است.",
        });
      }

      const result =
        await pool.query(
          `
          UPDATE customers
          SET
            name = $1,
            phone = $2,
            address = $3,
            notes = $4
          WHERE id::text = $5
          RETURNING *
          `,
          [
            name,
            phone,
            address || null,
            notes || null,
            id,
          ]
        );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          message:
            "مشتری پیدا نشد.",
        });
      }

      res.json({
        ok: true,
        customer:
          result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ویرایش مشتری.",
      });
    }
  }
);

/* =========================================================
   MOTORCYCLES
========================================================= */

app.get(
  "/api/motorcycles",
  requireAuth,
  async (req, res) => {
    try {
      const customerId =
        normalize(
          req.query?.customer_id
        );

      const result = customerId
        ? await pool.query(
            `
            SELECT
              m.*,
              c.name AS customer_name,
              c.phone AS customer_phone
            FROM motorcycles m
            JOIN customers c
              ON c.id = m.customer_id
            WHERE m.customer_id = $1
            ORDER BY m.created_at DESC
            `,
            [customerId]
          )
        : await pool.query(`
            SELECT
              m.*,
              c.name AS customer_name,
              c.phone AS customer_phone
            FROM motorcycles m
            JOIN customers c
              ON c.id = m.customer_id
            ORDER BY m.created_at DESC
          `);

      res.json({
        ok: true,
        motorcycles:
          result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت موتورسیکلت‌ها.",
      });
    }
  }
);

app.post(
  "/api/motorcycles",
  requireAuth,
  async (req, res) => {
    try {
      const customerId =
        normalize(
          req.body?.customer_id
        );

      const plate = normalize(
        req.body?.plate
      );

      const brand = normalize(
        req.body?.brand
      );

      const model = normalize(
        req.body?.model
      );

      const year = numberValue(
        req.body?.year,
        0
      );

      const color = normalize(
        req.body?.color
      );

      const vin = normalize(
        req.body?.vin
      );

      const mileage = Math.max(
        0,
        Math.floor(
          numberValue(
            req.body?.mileage,
            0
          )
        )
      );

      if (!customerId || !plate) {
        return res.status(400).json({
          ok: false,
          message:
            "مشتری و پلاک الزامی هستند.",
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO motorcycles (
            customer_id,
            plate,
            brand,
            model,
            year,
            color,
            vin,
            mileage
          )
          VALUES (
            $1, $2, $3, $4,
            $5, $6, $7, $8
          )
          RETURNING *
          `,
          [
            customerId,
            plate,
            brand || null,
            model || null,
            year || null,
            color || null,
            vin || null,
            mileage,
          ]
        );

      res.status(201).json({
        ok: true,
        motorcycle:
          result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ثبت موتورسیکلت.",
      });
    }
  }
);

app.patch(
  "/api/motorcycles/:id",
  requireAuth,
  async (req, res) => {
    try {
      const id = normalize(
        req.params.id
      );

      const plate = normalize(
        req.body?.plate
      );

      if (!plate) {
        return res.status(400).json({
          ok: false,
          message:
            "پلاک الزامی است.",
        });
      }

      const result =
        await pool.query(
          `
          UPDATE motorcycles
          SET
            plate = $1,
            brand = $2,
            model = $3,
            year = $4,
            color = $5,
            vin = $6,
            mileage = $7
          WHERE id::text = $8
          RETURNING *
          `,
          [
            plate,
            normalize(req.body?.brand) ||
              null,
            normalize(req.body?.model) ||
              null,
            numberValue(
              req.body?.year,
              0
            ) || null,
            normalize(req.body?.color) ||
              null,
            normalize(req.body?.vin) ||
              null,
            Math.max(
              0,
              Math.floor(
                numberValue(
                  req.body?.mileage,
                  0
                )
              )
            ),
            id,
          ]
        );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          message:
            "موتورسیکلت پیدا نشد.",
        });
      }

      res.json({
        ok: true,
        motorcycle:
          result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ویرایش موتورسیکلت.",
      });
    }
  }
);

/* =========================================================
   TECHNICIANS
========================================================= */

app.get(
  "/api/technicians",
  requireAuth,
  async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT *
        FROM technicians
        ORDER BY active DESC, name ASC
      `);

      res.json({
        ok: true,
        technicians:
          result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت تکنسین‌ها.",
      });
    }
  }
);

app.post(
  "/api/technicians",
  requireAuth,
  requireRoles(
    "OWNER",
    "EXECUTIVE"
  ),
  async (req, res) => {
    try {
      const name = normalize(
        req.body?.name
      );

      if (!name) {
        return res.status(400).json({
          ok: false,
          message:
            "نام تکنسین الزامی است.",
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO technicians (
            name,
            phone,
            specialty,
            active
          )
          VALUES ($1, $2, $3, $4)
          RETURNING *
          `,
          [
            name,
            normalize(req.body?.phone) ||
              null,
            normalize(
              req.body?.specialty
            ) || null,
            req.body?.active !== false,
          ]
        );

      res.status(201).json({
        ok: true,
        technician:
          result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ثبت تکنسین.",
      });
    }
  }
);

app.patch(
  "/api/technicians/:id",
  requireAuth,
  requireRoles(
    "OWNER",
    "EXECUTIVE"
  ),
  async (req, res) => {
    try {
      const id = normalize(
        req.params.id
      );

      const name = normalize(
        req.body?.name
      );

      if (!name) {
        return res.status(400).json({
          ok: false,
          message:
            "نام تکنسین الزامی است.",
        });
      }

      const result =
        await pool.query(
          `
          UPDATE technicians
          SET
            name = $1,
            phone = $2,
            specialty = $3,
            active = $4
          WHERE id::text = $5
          RETURNING *
          `,
          [
            name,
            normalize(req.body?.phone) ||
              null,
            normalize(
              req.body?.specialty
            ) || null,
            req.body?.active !== false,
            id,
          ]
        );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          message:
            "تکنسین پیدا نشد.",
        });
      }

      res.json({
        ok: true,
        technician:
          result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ویرایش تکنسین.",
      });
    }
  }
);

/* =========================================================
   SERVICE CASES
========================================================= */

app.get(
  "/api/cases",
  requireAuth,
  async (req, res) => {
    try {
      const code = normalize(
        req.query?.code
      );

      const status = normalize(
        req.query?.status
      );

      let result;

      if (code) {
        result = await pool.query(
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
            sc.case_code = $1
            OR sc.id::text = $1
          ORDER BY sc.created_at DESC
          `,
          [code]
        );
      } else if (status) {
        result = await pool.query(
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
          WHERE sc.status = $1
          ORDER BY sc.created_at DESC
          `,
          [status]
        );
      } else {
        result = await pool.query(`
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
      }

      res.json({
        ok: true,
        cases: result.rows,
        case:
          result.rows[0] || null,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت پرونده‌ها.",
      });
    }
  }
);

/* =========================================================
   CASE DETAIL
========================================================= */

app.get(
  "/api/cases/:id",
  requireAuth,
  async (req, res) => {
    try {
      const id = normalize(
        req.params.id
      );

      const caseResult =
        await pool.query(
          `
          SELECT
            sc.*,
            c.name AS customer_name,
            c.phone AS customer_phone,
            c.address AS customer_address,
            m.brand AS motorcycle_brand,
            m.model AS motorcycle_model,
            m.plate AS motorcycle_plate,
            m.year AS motorcycle_year,
            m.color AS motorcycle_color,
            m.mileage AS motorcycle_mileage
          FROM service_cases sc
          LEFT JOIN customers c
            ON c.id = sc.customer_id
          LEFT JOIN motorcycles m
            ON m.id = sc.motorcycle_id
          WHERE
            sc.id::text = $1
            OR sc.case_code = $1
          LIMIT 1
          `,
          [id]
        );

      const serviceCase =
        caseResult.rows[0];

      if (!serviceCase) {
        return res.status(404).json({
          ok: false,
          message:
            "پرونده پیدا نشد.",
        });
      }

      const [
        tasks,
        parts,
        estimate,
        payments,
        notes,
        history,
      ] = await Promise.all([
        pool.query(
          `
          SELECT
            t.*,
            tech.name AS technician_name
          FROM tasks t
          LEFT JOIN technicians tech
            ON tech.id = t.technician_id
          WHERE t.case_id = $1
          ORDER BY t.title ASC
          `,
          [serviceCase.id]
        ),

        pool.query(
          `
          SELECT
            cp.*,
            p.name AS part_name,
            p.sku,
            p.stock_qty
          FROM case_parts cp
          JOIN parts p
            ON p.id = cp.part_id
          WHERE cp.case_id = $1
          ORDER BY p.name ASC
          `,
          [serviceCase.id]
        ),

        pool.query(
          `
          SELECT *
          FROM estimates
          WHERE case_id = $1
          LIMIT 1
          `,
          [serviceCase.id]
        ),

        pool.query(
          `
          SELECT *
          FROM payments
          WHERE case_id = $1
          ORDER BY paid_at DESC
          `,
          [serviceCase.id]
        ),

        pool.query(
          `
          SELECT *
          FROM case_notes
          WHERE case_id = $1
          ORDER BY created_at DESC
          `,
          [serviceCase.id]
        ),

        pool.query(
          `
          SELECT *
          FROM case_history
          WHERE case_id = $1
          ORDER BY created_at DESC
          `,
          [serviceCase.id]
        ),
      ]);

      const estimateRow =
        estimate.rows[0] || null;

      const paid = payments.rows.reduce(
        (
          total: number,
          item: any
        ) =>
          total +
          Number(item.amount || 0),
        0
      );

      const total = Number(
        estimateRow?.total || 0
      );

      res.json({
        ok: true,
        case: serviceCase,
        tasks: tasks.rows,
        parts: parts.rows,
        estimate: estimateRow,
        payments: payments.rows,
        notes: notes.rows,
        history: history.rows,
        financial: {
          total,
          paid,
          balance: Math.max(
            total - paid,
            0
          ),
        },
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت پرونده.",
      });
    }
  }
);

/* =========================================================
   CREATE CASE
========================================================= */

app.post(
  "/api/cases",
  requireAuth,
  async (req, res) => {
    try {
      const customerId =
        normalize(
          req.body?.customer_id
        );

      const motorcycleId =
        normalize(
          req.body?.motorcycle_id
        );

      const complaint =
        normalize(
          req.body?.complaint ??
            req.body?.description
        );

      const diagnosis =
        normalize(
          req.body?.diagnosis
        );

      const priority =
        normalize(
          req.body?.priority
        ) || "NORMAL";

      const status =
        normalize(
          req.body?.status
        ) || "OPEN";

      if (
        !customerId ||
        !motorcycleId ||
        !complaint
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "مشتری، موتورسیکلت و شرح درخواست الزامی هستند.",
        });
      }

      if (
        !CASE_STATUSES.includes(
          status as any
        )
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "وضعیت پرونده نامعتبر است.",
        });
      }

      const code =
        normalize(
          req.body?.case_code ??
            req.body?.code
        ) ||
        generateCaseCode();

      const result =
        await pool.query(
          `
          INSERT INTO service_cases (
            customer_id,
            motorcycle_id,
            complaint,
            diagnosis,
            status,
            priority,
            case_code
          )
          VALUES (
            $1, $2, $3, $4,
            $5, $6, $7
          )
          RETURNING *
          `,
          [
            customerId,
            motorcycleId,
            complaint,
            diagnosis || null,
            status,
            priority,
            code,
          ]
        );

      const created =
        result.rows[0];

      await pool.query(
        `
        INSERT INTO case_history (
          case_id,
          action,
          to_status,
          note
        )
        VALUES (
          $1,
          'CASE_CREATED',
          $2,
          $3
        )
        `,
        [
          created.id,
          created.status,
          "پرونده جدید ایجاد شد.",
        ]
      );

      res.status(201).json({
        ok: true,
        case: created,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ایجاد پرونده.",
      });
    }
  }
);

/* =========================================================
   UPDATE CASE
========================================================= */

app.patch(
  "/api/cases/:id",
  requireAuth,
  async (req, res) => {
    try {
      const id = normalize(
        req.params.id
      );

      const current =
        await pool.query(
          `
          SELECT *
          FROM service_cases
          WHERE
            id::text = $1
            OR case_code = $1
          LIMIT 1
          `,
          [id]
        );

      if (!current.rows[0]) {
        return res.status(404).json({
          ok: false,
          message:
            "پرونده پیدا نشد.",
        });
      }

      const existing =
        current.rows[0];

      const complaint =
        normalize(
          req.body?.complaint ??
            req.body?.description
        ) ||
        existing.complaint;

      const diagnosis =
        normalize(
          req.body?.diagnosis
        ) ||
        existing.diagnosis;

      const priority =
        normalize(
          req.body?.priority
        ) ||
        existing.priority;

      const result =
        await pool.query(
          `
          UPDATE service_cases
          SET
            complaint = $1,
            diagnosis = $2,
            priority = $3,
            updated_at = NOW()
          WHERE id = $4
          RETURNING *
          `,
          [
            complaint,
            diagnosis || null,
            priority,
            existing.id,
          ]
        );

      res.json({
        ok: true,
        case: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ویرایش پرونده.",
      });
    }
  }
);

/* =========================================================
   CASE STATUS
========================================================= */

app.patch(
  "/api/cases/:id/status",
  requireAuth,
  async (req, res) => {
    try {
      const id = normalize(
        req.params.id
      );

      const status = normalize(
        req.body?.status
      );

      const note = normalize(
        req.body?.note
      );

      if (
        !CASE_STATUSES.includes(
          status as any
        )
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "وضعیت پرونده نامعتبر است.",
        });
      }

      const current =
        await pool.query(
          `
          SELECT *
          FROM service_cases
          WHERE
            id::text = $1
            OR case_code = $1
          LIMIT 1
          `,
          [id]
        );

      if (!current.rows[0]) {
        return res.status(404).json({
          ok: false,
          message:
            "پرونده پیدا نشد.",
        });
      }

      const existing =
        current.rows[0];

      if (
        existing.status === status
      ) {
        return res.json({
          ok: true,
          case: existing,
        });
      }

      const closedAt =
        status === "DELIVERED" ||
        status === "CANCELLED"
          ? new Date()
          : null;

      const result =
        await pool.query(
          `
          UPDATE service_cases
          SET
            status = $1,
            closed_at = $2,
            updated_at = NOW()
          WHERE id = $3
          RETURNING *
          `,
          [
            status,
            closedAt,
            existing.id,
          ]
        );

      const user =
        (req as any).user;

      await pool.query(
        `
        INSERT INTO case_history (
          case_id,
          action,
          from_status,
          to_status,
          note,
          actor_user_id
        )
        VALUES (
          $1,
          'STATUS_CHANGED',
          $2,
          $3,
          $4,
          $5
        )
        `,
        [
          existing.id,
          existing.status,
          status,
          note || null,
          user?.id || null,
        ]
      );

      res.json({
        ok: true,
        case: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در تغییر وضعیت پرونده.",
      });
    }
  }
);

/* =========================================================
   TASKS
========================================================= */

app.get(
  "/api/tasks",
  requireAuth,
  async (req, res) => {
    try {
      const caseId =
        normalize(
          req.query?.case_id
        );

      const technicianId =
        normalize(
          req.query?.technician_id
        );

      const conditions: string[] = [];
      const values: any[] = [];

      if (caseId) {
        values.push(caseId);
        conditions.push(
          `t.case_id = $${values.length}`
        );
      }

      if (technicianId) {
        values.push(technicianId);
        conditions.push(
          `t.technician_id = $${values.length}`
        );
      }

      const where =
        conditions.length
          ? `WHERE ${conditions.join(
              " AND "
            )}`
          : "";

      const result =
        await pool.query(
          `
          SELECT
            t.*,
            tech.name AS technician_name,
            sc.case_code,
            c.name AS customer_name,
            m.brand AS motorcycle_brand,
            m.model AS motorcycle_model
          FROM tasks t
          LEFT JOIN technicians tech
            ON tech.id = t.technician_id
          JOIN service_cases sc
            ON sc.id = t.case_id
          JOIN customers c
            ON c.id = sc.customer_id
          JOIN motorcycles m
            ON m.id = sc.motorcycle_id
          ${where}
          ORDER BY t.status ASC, t.title ASC
          `,
          values
        );

      res.json({
        ok: true,
        tasks: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت وظایف.",
      });
    }
  }
);

app.post(
  "/api/tasks",
  requireAuth,
  async (req, res) => {
    try {
      const caseId =
        normalize(
          req.body?.case_id
        );

      const technicianId =
        normalize(
          req.body?.technician_id
        );

      const title =
        normalize(
          req.body?.title
        );

      const description =
        normalize(
          req.body?.description
        );

      const status =
        normalize(
          req.body?.status
        ) || "TODO";

      const laborCost =
        Math.max(
          0,
          numberValue(
            req.body?.labor_cost,
            0
          )
        );

      if (!caseId || !title) {
        return res.status(400).json({
          ok: false,
          message:
            "پرونده و عنوان وظیفه الزامی هستند.",
        });
      }

      if (
        !TASK_STATUSES.includes(
          status as any
        )
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "وضعیت وظیفه نامعتبر است.",
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO tasks (
            case_id,
            technician_id,
            title,
            description,
            status,
            labor_cost,
            started_at,
            completed_at
          )
          VALUES (
            $1, $2, $3, $4,
            $5, $6,
            $7, $8
          )
          RETURNING *
          `,
          [
            caseId,
            technicianId || null,
            title,
            description || null,
            status,
            laborCost,
            status === "IN_PROGRESS"
              ? new Date()
              : null,
            status === "DONE"
              ? new Date()
              : null,
          ]
        );

      res.status(201).json({
        ok: true,
        task: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ایجاد وظیفه.",
      });
    }
  }
);

app.patch(
  "/api/tasks/:id",
  requireAuth,
  async (req, res) => {
    try {
      const id = normalize(
        req.params.id
      );

      const current =
        await pool.query(
          `
          SELECT *
          FROM tasks
          WHERE id::text = $1
          LIMIT 1
          `,
          [id]
        );

      if (!current.rows[0]) {
        return res.status(404).json({
          ok: false,
          message:
            "وظیفه پیدا نشد.",
        });
      }

      const existing =
        current.rows[0];

      const status =
        normalize(
          req.body?.status
        ) ||
        existing.status;

      if (
        !TASK_STATUSES.includes(
          status as any
        )
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "وضعیت وظیفه نامعتبر است.",
        });
      }

      const result =
        await pool.query(
          `
          UPDATE tasks
          SET
            technician_id = $1,
            title = $2,
            description = $3,
            status = $4,
            labor_cost = $5,
            started_at = $6,
            completed_at = $7
          WHERE id = $8
          RETURNING *
          `,
          [
            normalize(
              req.body?.technician_id
            ) ||
              existing.technician_id ||
              null,

            normalize(
              req.body?.title
            ) || existing.title,

            normalize(
              req.body?.description
            ) ||
              existing.description ||
              null,

            status,

            Math.max(
              0,
              numberValue(
                req.body?.labor_cost,
                Number(
                  existing.labor_cost || 0
                )
              )
            ),

            status === "IN_PROGRESS"
              ? existing.started_at ||
                new Date()
              : existing.started_at,

            status === "DONE"
              ? existing.completed_at ||
                new Date()
              : status === "TODO"
              ? null
              : existing.completed_at,

            existing.id,
          ]
        );

      res.json({
        ok: true,
        task: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ویرایش وظیفه.",
      });
    }
  }
);

/* =========================================================
   PARTS
========================================================= */

app.get(
  "/api/parts",
  requireAuth,
  async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT *
        FROM parts
        ORDER BY name ASC
      `);

      res.json({
        ok: true,
        parts: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت قطعات.",
      });
    }
  }
);

app.post(
  "/api/parts",
  requireAuth,
  requireRoles(
    "OWNER",
    "EXECUTIVE"
  ),
  async (req, res) => {
    try {
      const name =
        normalize(
          req.body?.name
        );

      if (!name) {
        return res.status(400).json({
          ok: false,
          message:
            "نام قطعه الزامی است.",
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO parts (
            name,
            sku,
            stock_qty,
            unit_cost,
            sale_price
          )
          VALUES (
            $1, $2, $3, $4, $5
          )
          RETURNING *
          `,
          [
            name,
            normalize(
              req.body?.sku
            ) || null,
            Math.max(
              0,
              Math.floor(
                numberValue(
                  req.body?.stock_qty,
                  0
                )
              )
            ),
            Math.max(
              0,
              numberValue(
                req.body?.unit_cost,
                0
              )
            ),
            Math.max(
              0,
              numberValue(
                req.body?.sale_price,
                0
              )
            ),
          ]
        );

      res.status(201).json({
        ok: true,
        part: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ثبت قطعه.",
      });
    }
  }
);

app.patch(
  "/api/parts/:id",
  requireAuth,
  requireRoles(
    "OWNER",
    "EXECUTIVE"
  ),
  async (req, res) => {
    try {
      const id = normalize(
        req.params.id
      );

      const result =
        await pool.query(
          `
          UPDATE parts
          SET
            name = $1,
            sku = $2,
            stock_qty = $3,
            unit_cost = $4,
            sale_price = $5
          WHERE id::text = $6
          RETURNING *
          `,
          [
            normalize(
              req.body?.name
            ),
            normalize(
              req.body?.sku
            ) || null,
            Math.max(
              0,
              Math.floor(
                numberValue(
                  req.body?.stock_qty,
                  0
                )
              )
            ),
            Math.max(
              0,
              numberValue(
                req.body?.unit_cost,
                0
              )
            ),
            Math.max(
              0,
              numberValue(
                req.body?.sale_price,
                0
              )
            ),
            id,
          ]
        );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          message:
            "قطعه پیدا نشد.",
        });
      }

      res.json({
        ok: true,
        part: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ویرایش قطعه.",
      });
    }
  }
);

/* =========================================================
   CASE PARTS
========================================================= */

app.post(
  "/api/cases/:caseId/parts",
  requireAuth,
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const caseId =
        normalize(
          req.params.caseId
        );

      const partId =
        normalize(
          req.body?.part_id
        );

      const quantity = Math.max(
        1,
        Math.floor(
          numberValue(
            req.body?.quantity,
            1
          )
        )
      );

      if (!caseId || !partId) {
        return res.status(400).json({
          ok: false,
          message:
            "پرونده و قطعه الزامی هستند.",
        });
      }

      await client.query(
        "BEGIN"
      );

      const part =
        await client.query(
          `
          SELECT *
          FROM parts
          WHERE id = $1
          FOR UPDATE
          `,
          [partId]
        );

      if (!part.rows[0]) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(404).json({
          ok: false,
          message:
            "قطعه پیدا نشد.",
        });
      }

      const selected =
        part.rows[0];

      if (
        Number(
          selected.stock_qty
        ) < quantity
      ) {
        await client.query(
          "ROLLBACK"
        );

        return res.status(400).json({
          ok: false,
          message:
            "موجودی قطعه کافی نیست.",
        });
      }

      const unitPrice =
        Math.max(
          0,
          numberValue(
            req.body?.unit_price,
            Number(
              selected.sale_price || 0
            )
          )
        );

      const inserted =
        await client.query(
          `
          INSERT INTO case_parts (
            case_id,
            part_id,
            quantity,
            unit_price
          )
          VALUES ($1, $2, $3, $4)
          RETURNING *
          `,
          [
            caseId,
            partId,
            quantity,
            unitPrice,
          ]
        );

      await client.query(
        `
        UPDATE parts
        SET stock_qty = stock_qty - $1
        WHERE id = $2
        `,
        [quantity, partId]
      );

      await client.query(
        "COMMIT"
      );

      res.status(201).json({
        ok: true,
        casePart:
          inserted.rows[0],
      });
    } catch (error) {
      await client.query(
        "ROLLBACK"
      );

      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در افزودن قطعه به پرونده.",
      });
    } finally {
      client.release();
    }
  }
);

app.get(
  "/api/cases/:caseId/parts",
  requireAuth,
  async (req, res) => {
    try {
      const caseId =
        normalize(
          req.params.caseId
        );

      const result =
        await pool.query(
          `
          SELECT
            cp.*,
            p.name AS part_name,
            p.sku
          FROM case_parts cp
          JOIN parts p
            ON p.id = cp.part_id
          WHERE cp.case_id = $1
          ORDER BY p.name ASC
          `,
          [caseId]
        );

      res.json({
        ok: true,
        parts: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت قطعات پرونده.",
      });
    }
  }
);

/* =========================================================
   ESTIMATES
========================================================= */

async function calculateEstimate(
  caseId: string,
  discount: number
) {
  const labor =
    await pool.query(
      `
      SELECT
        COALESCE(
          SUM(labor_cost),
          0
        ) AS labor
      FROM tasks
      WHERE case_id = $1
        AND status <> 'CANCELLED'
      `,
      [caseId]
    );

  const parts =
    await pool.query(
      `
      SELECT
        COALESCE(
          SUM(
            quantity * unit_price
          ),
          0
        ) AS parts
      FROM case_parts
      WHERE case_id = $1
      `,
      [caseId]
    );

  const laborTotal =
    Number(
      labor.rows[0]?.labor || 0
    );

  const partsTotal =
    Number(
      parts.rows[0]?.parts || 0
    );

  const subtotal =
    laborTotal + partsTotal;

  const safeDiscount =
    Math.min(
      Math.max(0, discount),
      subtotal
    );

  const total =
    subtotal - safeDiscount;

  return {
    laborTotal,
    partsTotal,
    subtotal,
    discount: safeDiscount,
    total,
  };
}

app.get(
  "/api/cases/:caseId/estimate",
  requireAuth,
  async (req, res) => {
    try {
      const caseId =
        normalize(
          req.params.caseId
        );

      const result =
        await pool.query(
          `
          SELECT *
          FROM estimates
          WHERE case_id = $1
          LIMIT 1
          `,
          [caseId]
        );

      if (!result.rows[0]) {
        return res.json({
          ok: true,
          estimate: null,
        });
      }

      res.json({
        ok: true,
        estimate:
          result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت برآورد.",
      });
    }
  }
);

app.post(
  "/api/cases/:caseId/estimate",
  requireAuth,
  requireRoles(
    "OWNER",
    "EXECUTIVE",
    "RECEPTION"
  ),
  async (req, res) => {
    try {
      const caseId =
        normalize(
          req.params.caseId
        );

      const discount = Math.max(
        0,
        numberValue(
          req.body?.discount,
          0
        )
      );

      const calculated =
        await calculateEstimate(
          caseId,
          discount
        );

      const existing =
        await pool.query(
          `
          SELECT id
          FROM estimates
          WHERE case_id = $1
          LIMIT 1
          `,
          [caseId]
        );

      let result;

      if (existing.rows[0]) {
        result = await pool.query(
          `
          UPDATE estimates
          SET
            subtotal = $1,
            discount = $2,
            total = $3,
            status = 'DRAFT'
          WHERE id = $4
          RETURNING *
          `,
          [
            calculated.subtotal,
            calculated.discount,
            calculated.total,
            existing.rows[0].id,
          ]
        );
      } else {
        result = await pool.query(
          `
          INSERT INTO estimates (
            case_id,
            subtotal,
            discount,
            total,
            status
          )
          VALUES (
            $1, $2, $3, $4, 'DRAFT'
          )
          RETURNING *
          `,
          [
            caseId,
            calculated.subtotal,
            calculated.discount,
            calculated.total,
          ]
        );
      }

      res.status(201).json({
        ok: true,
        estimate:
          result.rows[0],
        calculation:
          calculated,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ایجاد برآورد.",
      });
    }
  }
);

app.post(
  "/api/estimates/:id/submit",
  requireAuth,
  async (req, res) => {
    try {
      const id = normalize(
        req.params.id
      );

      const result =
        await pool.query(
          `
          UPDATE estimates
          SET
            status = 'PENDING_APPROVAL'
          WHERE id::text = $1
          RETURNING *
          `,
          [id]
        );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          message:
            "برآورد پیدا نشد.",
        });
      }

      await pool.query(
        `
        UPDATE service_cases
        SET
          status = 'WAITING_APPROVAL',
          updated_at = NOW()
        WHERE id = $1
        `,
        [result.rows[0].case_id]
      );

      res.json({
        ok: true,
        estimate:
          result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ارسال برآورد برای تأیید.",
      });
    }
  }
);

app.post(
  "/api/estimates/:id/approve",
  requireAuth,
  requireRoles(
    "OWNER",
    "EXECUTIVE"
  ),
  async (req, res) => {
    try {
      const id = normalize(
        req.params.id
      );

      const result =
        await pool.query(
          `
          UPDATE estimates
          SET
            status = 'APPROVED',
            approved_at = NOW()
          WHERE id::text = $1
          RETURNING *
          `,
          [id]
        );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          message:
            "برآورد پیدا نشد.",
        });
      }

      await pool.query(
        `
        UPDATE service_cases
        SET
          status = 'APPROVED',
          updated_at = NOW()
        WHERE id = $1
        `,
        [result.rows[0].case_id]
      );

      res.json({
        ok: true,
        estimate:
          result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در تأیید برآورد.",
      });
    }
  }
);

app.post(
  "/api/estimates/:id/reject",
  requireAuth,
  requireRoles(
    "OWNER",
    "EXECUTIVE"
  ),
  async (req, res) => {
    try {
      const id = normalize(
        req.params.id
      );

      const result =
        await pool.query(
          `
          UPDATE estimates
          SET
            status = 'REJECTED',
            approved_at = NULL
          WHERE id::text = $1
          RETURNING *
          `,
          [id]
        );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          message:
            "برآورد پیدا نشد.",
        });
      }

      await pool.query(
        `
        UPDATE service_cases
        SET
          status = 'WAITING_APPROVAL',
          updated_at = NOW()
        WHERE id = $1
        `,
        [result.rows[0].case_id]
      );

      res.json({
        ok: true,
        estimate:
          result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در رد برآورد.",
      });
    }
  }
);

/* =========================================================
   PAYMENTS
========================================================= */

app.get(
  "/api/cases/:caseId/payments",
  requireAuth,
  async (req, res) => {
    try {
      const caseId =
        normalize(
          req.params.caseId
        );

      const result =
        await pool.query(
          `
          SELECT *
          FROM payments
          WHERE case_id = $1
          ORDER BY paid_at DESC
          `,
          [caseId]
        );

      const totalPaid =
        result.rows.reduce(
          (
            total: number,
            item: any
          ) =>
            total +
            Number(
              item.amount || 0
            ),
          0
        );

      res.json({
        ok: true,
        payments:
          result.rows,
        totalPaid,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت پرداخت‌ها.",
      });
    }
  }
);

app.post(
  "/api/cases/:caseId/payments",
  requireAuth,
  async (req, res) => {
    try {
      const caseId =
        normalize(
          req.params.caseId
        );

      const amount =
        positiveNumber(
          req.body?.amount
        );

      const method =
        normalize(
          req.body?.method
        );

      const reference =
        normalize(
          req.body?.reference
        );

      if (!amount || !method) {
        return res.status(400).json({
          ok: false,
          message:
            "مبلغ و روش پرداخت الزامی است.",
        });
      }

      const estimate =
        await pool.query(
          `
          SELECT total
          FROM estimates
          WHERE
            case_id = $1
            AND status = 'APPROVED'
          LIMIT 1
          `,
          [caseId]
        );

      if (!estimate.rows[0]) {
        return res.status(400).json({
          ok: false,
          message:
            "ابتدا باید برآورد پرونده تأیید شود.",
        });
      }

      const total =
        Number(
          estimate.rows[0].total || 0
        );

      const paid =
        await pool.query(
          `
          SELECT
            COALESCE(
              SUM(amount),
              0
            ) AS paid
          FROM payments
          WHERE case_id = $1
          `,
          [caseId]
        );

      const alreadyPaid =
        Number(
          paid.rows[0]?.paid || 0
        );

      const balance = Math.max(
        total - alreadyPaid,
        0
      );

      if (amount > balance) {
        return res.status(400).json({
          ok: false,
          message:
            "مبلغ پرداختی بیشتر از مانده حساب است.",
          balance,
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO payments (
            case_id,
            amount,
            method,
            reference
          )
          VALUES ($1, $2, $3, $4)
          RETURNING *
          `,
          [
            caseId,
            amount,
            method,
            reference || null,
          ]
        );

      res.status(201).json({
        ok: true,
        payment:
          result.rows[0],
        financial: {
          total,
          paid:
            alreadyPaid + amount,
          balance:
            Math.max(
              total -
                alreadyPaid -
                amount,
              0
            ),
        },
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ثبت پرداخت.",
      });
    }
  }
);

/* =========================================================
   DELIVERY
========================================================= */

app.post(
  "/api/cases/:caseId/deliver",
  requireAuth,
  requireRoles(
    "OWNER",
    "EXECUTIVE",
    "RECEPTION"
  ),
  async (req, res) => {
    try {
      const caseId =
        normalize(
          req.params.caseId
        );

      const current =
        await pool.query(
          `
          SELECT *
          FROM service_cases
          WHERE
            id::text = $1
            OR case_code = $1
          LIMIT 1
          `,
          [caseId]
        );

      if (!current.rows[0]) {
        return res.status(404).json({
          ok: false,
          message:
            "پرونده پیدا نشد.",
        });
      }

      const serviceCase =
        current.rows[0];

      const estimate =
        await pool.query(
          `
          SELECT *
          FROM estimates
          WHERE case_id = $1
          LIMIT 1
          `,
          [serviceCase.id]
        );

      if (
        !estimate.rows[0] ||
        estimate.rows[0].status !==
          "APPROVED"
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "برآورد پرونده هنوز تأیید نشده است.",
        });
      }

      const payment =
        await pool.query(
          `
          SELECT
            COALESCE(
              SUM(amount),
              0
            ) AS paid
          FROM payments
          WHERE case_id = $1
          `,
          [serviceCase.id]
        );

      const total =
        Number(
          estimate.rows[0].total || 0
        );

      const paid =
        Number(
          payment.rows[0]?.paid || 0
        );

      const balance = Math.max(
        total - paid,
        0
      );

      if (balance > 0) {
        return res.status(400).json({
          ok: false,
          message:
            "پرونده هنوز مانده حساب دارد و قابل تحویل نیست.",
          balance,
        });
      }

      const user =
        (req as any).user;

      const result =
        await pool.query(
          `
          UPDATE service_cases
          SET
            status = 'DELIVERED',
            closed_at = NOW(),
            delivered_at = NOW(),
            delivered_by = $1,
            updated_at = NOW()
          WHERE id = $2
          RETURNING *
          `,
          [
            user?.id || null,
            serviceCase.id,
          ]
        );

      await pool.query(
        `
        INSERT INTO case_history (
          case_id,
          action,
          from_status,
          to_status,
          note,
          actor_user_id
        )
        VALUES (
          $1,
          'CASE_DELIVERED',
          $2,
          'DELIVERED',
          $3,
          $4
        )
        `,
        [
          serviceCase.id,
          serviceCase.status,
          normalize(
            req.body?.note
          ) ||
            "موتورسیکلت به مشتری تحویل شد.",
          user?.id || null,
        ]
      );

      res.json({
        ok: true,
        case: result.rows[0],
        financial: {
          total,
          paid,
          balance: 0,
        },
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در تحویل موتورسیکلت.",
      });
    }
  }
);

/* =========================================================
   NOTES
========================================================= */

app.get(
  "/api/cases/:caseId/notes",
  requireAuth,
  async (req, res) => {
    try {
      const caseId =
        normalize(
          req.params.caseId
        );

      const result =
        await pool.query(
          `
          SELECT *
          FROM case_notes
          WHERE case_id = $1
          ORDER BY created_at DESC
          `,
          [caseId]
        );

      res.json({
        ok: true,
        notes: result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت یادداشت‌ها.",
      });
    }
  }
);

app.post(
  "/api/cases/:caseId/notes",
  requireAuth,
  async (req, res) => {
    try {
      const caseId =
        normalize(
          req.params.caseId
        );

      const body =
        normalize(
          req.body?.body ??
            req.body?.note
        );

      if (!body) {
        return res.status(400).json({
          ok: false,
          message:
            "متن یادداشت الزامی است.",
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO case_notes (
            case_id,
            body
          )
          VALUES ($1, $2)
          RETURNING *
          `,
          [caseId, body]
        );

      const user =
        (req as any).user;

      await pool.query(
        `
        INSERT INTO case_history (
          case_id,
          action,
          note,
          actor_user_id
        )
        VALUES (
          $1,
          'NOTE_ADDED',
          $2,
          $3
        )
        `,
        [
          caseId,
          body,
          user?.id || null,
        ]
      );

      res.status(201).json({
        ok: true,
        note: result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در ثبت یادداشت.",
      });
    }
  }
);

/* =========================================================
   HISTORY
========================================================= */

app.get(
  "/api/cases/:caseId/history",
  requireAuth,
  async (req, res) => {
    try {
      const caseId =
        normalize(
          req.params.caseId
        );

      const result =
        await pool.query(
          `
          SELECT
            h.*,
            u.username AS actor_username
          FROM case_history h
          LEFT JOIN users u
            ON u.id = h.actor_user_id
          WHERE h.case_id = $1
          ORDER BY h.created_at DESC
          `,
          [caseId]
        );

      res.json({
        ok: true,
        history:
          result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت تاریخچه پرونده.",
      });
    }
  }
);

/* =========================================================
   PUBLIC CUSTOMER REQUESTS
========================================================= */

app.post(
  "/api/customer-requests",
  async (req, res) => {
    try {
      const name =
        normalize(
          req.body?.name
        );

      const phone =
        normalize(
          req.body?.phone
        );

      const motorcycle =
        normalize(
          req.body?.motorcycle
        );

      const service =
        normalize(
          req.body?.service
        );

      const description =
        normalize(
          req.body?.description
        );

      if (!name || !phone) {
        return res.status(400).json({
          ok: false,
          message:
            "نام و شماره تماس الزامی است.",
        });
      }

      const result =
        await pool.query(
          `
          INSERT INTO customer_requests (
            name,
            phone,
            motorcycle,
            service,
            description,
            status
          )
          VALUES (
            $1, $2, $3, $4, $5, 'NEW'
          )
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
          "درخواست شما با موفقیت ثبت شد.",
        request:
          result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "ثبت درخواست با خطا مواجه شد.",
      });
    }
  }
);

/* =========================================================
   CUSTOMER REQUESTS - ADMIN
========================================================= */

app.get(
  "/api/customer-requests",
  requireAuth,
  requireRoles(
    "OWNER",
    "EXECUTIVE"
  ),
  async (req, res) => {
    try {
      const status =
        normalize(
          req.query?.status
        );

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
        requests:
          result.rows,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت درخواست‌های مشتریان.",
      });
    }
  }
);

app.get(
  "/api/customer-requests/:requestId",
  requireAuth,
  requireRoles(
    "OWNER",
    "EXECUTIVE"
  ),
  async (req, res) => {
    try {
      const requestId =
        normalize(
          req.params.requestId
        );

      const result =
        await pool.query(
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
          message:
            "درخواست پیدا نشد.",
        });
      }

      res.json({
        ok: true,
        request:
          result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در دریافت درخواست.",
      });
    }
  }
);

app.patch(
  "/api/customer-requests/:requestId",
  requireAuth,
  requireRoles(
    "OWNER",
    "EXECUTIVE"
  ),
  async (req, res) => {
    try {
      const requestId =
        normalize(
          req.params.requestId
        );

      const status =
        normalize(
          req.body?.status
        );

      if (!status) {
        return res.status(400).json({
          ok: false,
          message:
            "وضعیت درخواست الزامی است.",
        });
      }

      const result =
        await pool.query(
          `
          UPDATE customer_requests
          SET
            status = $1,
            updated_at = NOW()
          WHERE id::text = $2
          RETURNING *
          `,
          [
            status,
            requestId,
          ]
        );

      if (!result.rows[0]) {
        return res.status(404).json({
          ok: false,
          message:
            "درخواست پیدا نشد.",
        });
      }

      res.json({
        ok: true,
        request:
          result.rows[0],
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        ok: false,
        message:
          "خطا در تغییر وضعیت درخواست.",
      });
    }
  }
);

/* =========================================================
   404
========================================================= */

app.use(
  (
    _req,
    res
  ) => {
    res.status(404).json({
      ok: false,
      message:
        "مسیر مورد نظر پیدا نشد.",
    });
  }
);

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    error: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(
      "Unhandled API error:",
      error
    );

    res.status(500).json({
      ok: false,
      message:
        "خطای داخلی سرور.",
    });
  }
);

/* =========================================================
   START
========================================================= */

async function start() {
  try {
    await pool.query(
      "SELECT 1"
    );

    await ensureAuthTables();

    await ensureOperationalTables();

    await ensureAdminUser();

    app.listen(
      PORT,
      () => {
        console.log(
          `MotoClinic API v1.0.0 running on port ${PORT}`
        );
      }
    );
  } catch (error) {
    console.error(
      "Failed to start MotoClinic API:",
      error
    );

    process.exit(1);
  }
}

start();
