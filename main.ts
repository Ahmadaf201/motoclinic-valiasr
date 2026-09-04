import express from "express";
import cors from "cors";
import { Pool } from "pg";
import crypto from "crypto";

const app = express();

app.use(cors());
app.use(express.json());

const port = Number(process.env.API_PORT || 4000);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

/* =========================
   TYPES
========================= */

type Role = "OWNER" | "EXECUTIVE" | "TECHNICIAN";

type AuthUser = {
  id: string;
  username: string;
  full_name: string | null;
  role: Role;
};

/* =========================
   HELPERS
========================= */

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");

  const hash = crypto
    .scryptSync(password, salt, 64)
    .toString("hex");

  return { hash, salt };
}

function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string
) {
  const hash = crypto
    .scryptSync(password, storedSalt, 64)
    .toString("hex");

  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(storedHash, "hex");

  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

/* =========================
   AUTH TABLES
========================= */

async function ensureAuthTables() {
  await pool.query(`
    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      username text unique not null,
      full_name text,
      password_hash text not null,
      password_salt text not null,
      role text not null default 'OWNER',
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create table if not exists sessions (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      token text unique not null,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `);

  await pool.query(`
    create index if not exists idx_sessions_token
    on sessions(token)
  `);

  await pool.query(`
    create index if not exists idx_sessions_user_id
    on sessions(user_id)
  `);

  const adminUsername = clean(process.env.ADMIN_USERNAME);
  const adminPassword = clean(process.env.ADMIN_PASSWORD);

  if (adminUsername && adminPassword) {
    const existing = await pool.query(
      `
      select id
      from users
      where username = $1
      `,
      [adminUsername]
    );

    if (existing.rowCount === 0) {
      const { hash, salt } = hashPassword(adminPassword);

      await pool.query(
        `
        insert into users
          (
            username,
            full_name,
            password_hash,
            password_salt,
            role
          )
        values
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
    } else if (
      clean(process.env.RESET_ADMIN_PASSWORD) === "true"
    ) {
      const { hash, salt } = hashPassword(adminPassword);

      await pool.query(
        `
        update users
        set
          password_hash = $1,
          password_salt = $2,
          active = true,
          updated_at = now()
        where username = $3
        `,
        [
          hash,
          salt,
          adminUsername,
        ]
      );

      await pool.query(
        `
        delete from sessions
        where user_id = (
          select id
          from users
          where username = $1
        )
        `,
        [adminUsername]
      );

      console.log(
        "[AUTH] Admin password reset:",
        adminUsername
      );
    }
  }

  console.log("MotoClinic database/auth ready");
}

/* =========================
   AUTH FUNCTIONS
========================= */

async function getUserFromToken(
  token: string
): Promise<AuthUser | null> {
  const result = await pool.query(
    `
    select
      u.id,
      u.username,
      u.full_name,
      u.role
    from sessions s
    join users u on u.id = s.user_id
    where
      s.token = $1
      and s.expires_at > now()
      and u.active = true
    limit 1
    `,
    [token]
  );

  if (result.rowCount === 0) return null;

  return result.rows[0] as AuthUser;
}

async function authUser(
  req: express.Request
): Promise<AuthUser | null> {
  const header = clean(req.headers.authorization);

  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();

  if (!token) return null;

  return getUserFromToken(token);
}

function requireRoles(...roles: Role[]) {
  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    try {
      const user = await authUser(req);

      if (!user) {
        return res.status(401).json({
          error: "authentication required",
        });
      }

      if (!roles.includes(user.role)) {
        return res.status(403).json({
          error: "forbidden",
        });
      }

      (req as any).user = user;

      next();
    } catch (error) {
      console.error(error);

      res.status(500).json({
        error: "authentication error",
      });
    }
  };
}

/* =========================
   HEALTH
========================= */

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("select 1");

    res.json({
      ok: true,
      service: "motoclinic-api",
    });
  } catch {
    res.status(503).json({
      ok: false,
      service: "motoclinic-api",
      database: false,
    });
  }
});

app.get("/api", (_req, res) => {
  res.json({
    ok: true,
    service: "motoclinic-api",
  });
});

/* =========================
   AUTH
========================= */

app.post("/api/auth/login", async (req, res) => {
  try {
    const username = clean(req.body?.username);
    const password = String(req.body?.password ?? "");

    if (!username || !password) {
      return res.status(400).json({
        error: "username and password are required",
      });
    }

    const result = await pool.query(
      `
      select
        id,
        username,
        full_name,
        password_hash,
        password_salt,
        role,
        active
      from users
      where username = $1
      limit 1
      `,
      [username]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({
        error: "invalid credentials",
      });
    }

    const user = result.rows[0];

    if (!user.active) {
      return res.status(403).json({
        error: "user is inactive",
      });
    }

    const valid = verifyPassword(
      password,
      user.password_hash,
      user.password_salt
    );

    if (!valid) {
      return res.status(401).json({
        error: "invalid credentials",
      });
    }

    const token = createToken();

    await pool.query(
      `
      insert into sessions
        (user_id, token, expires_at)
      values
        ($1,$2,now() + interval '30 days')
      `,
      [user.id, token]
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "login failed",
    });
  }
});

app.get(
  "/api/auth/me",
  requireRoles("OWNER", "EXECUTIVE", "TECHNICIAN"),
  async (req, res) => {
    res.json({
      user: (req as any).user,
    });
  }
);

app.post(
  "/api/auth/logout",
  requireRoles("OWNER", "EXECUTIVE", "TECHNICIAN"),
  async (req, res) => {
    try {
      const header = clean(req.headers.authorization);
      const token = header.slice(7).trim();

      if (token) {
        await pool.query(
          `
          delete from sessions
          where token = $1
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
        error: "logout failed",
      });
    }
  }
);

/* =========================
   USERS
========================= */

app.get(
  "/api/users",
  requireRoles("OWNER"),
  async (_req, res) => {
    const result = await pool.query(`
      select
        id,
        username,
        full_name,
        role,
        active,
        created_at,
        updated_at
      from users
      order by created_at desc
    `);

    res.json(result.rows);
  }
);

app.post(
  "/api/users",
  requireRoles("OWNER"),
  async (req, res) => {
    try {
      const username = clean(req.body?.username);
      const fullName = clean(req.body?.full_name);
      const password = String(req.body?.password ?? "");
      const role = clean(req.body?.role) as Role;

      if (!username || !password || !role) {
        return res.status(400).json({
          error: "username, password and role are required",
        });
      }

      if (
        !["OWNER", "EXECUTIVE", "TECHNICIAN"].includes(role)
      ) {
        return res.status(400).json({
          error: "invalid role",
        });
      }

      const { hash, salt } = hashPassword(password);

      const result = await pool.query(
        `
        insert into users
          (
            username,
            full_name,
            password_hash,
            password_salt,
            role
          )
        values
          ($1,$2,$3,$4,$5)
        returning
          id,
          username,
          full_name,
          role,
          active,
          created_at
        `,
        [
          username,
          fullName || null,
          hash,
          salt,
          role,
        ]
      );

      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === "23505") {
        return res.status(409).json({
          error: "username already exists",
        });
      }

      console.error(error);

      res.status(500).json({
        error: "user creation failed",
      });
    }
  }
);

app.patch(
  "/api/users/:userId",
  requireRoles("OWNER"),
  async (req, res) => {
    const { userId } = req.params;

    const fullName = clean(req.body?.full_name);
    const role = clean(req.body?.role) as Role;
    const active = req.body?.active;

    if (
      role &&
      !["OWNER", "EXECUTIVE", "TECHNICIAN"].includes(role)
    ) {
      return res.status(400).json({
        error: "invalid role",
      });
    }

    const result = await pool.query(
      `
      update users
      set
        full_name = coalesce($1, full_name),
        role = coalesce($2, role),
        active = coalesce($3, active),
        updated_at = now()
      where id = $4
      returning
        id,
        username,
        full_name,
        role,
        active,
        updated_at
      `,
      [
        fullName || null,
        role || null,
        typeof active === "boolean" ? active : null,
        userId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "user not found",
      });
    }

    res.json(result.rows[0]);
  }
);

app.post(
  "/api/users/:userId/password",
  requireRoles("OWNER"),
  async (req, res) => {
    const { userId } = req.params;
    const password = String(req.body?.password ?? "");

    if (!password) {
      return res.status(400).json({
        error: "password is required",
      });
    }

    const { hash, salt } = hashPassword(password);

    const result = await pool.query(
      `
      update users
      set
        password_hash = $1,
        password_salt = $2,
        updated_at = now()
      where id = $3
      returning id, username
      `,
      [
        hash,
        salt,
        userId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "user not found",
      });
    }

    await pool.query(
      `
      delete from sessions
      where user_id = $1
      `,
      [userId]
    );

    res.json({
      ok: true,
      user: result.rows[0],
    });
  }
);

/* =========================
   DASHBOARD
========================= */

app.get("/api/dashboard", async (_req, res) => {
  const result = await pool.query(`
    select
      (select count(*) from customers) as customers,
      (select count(*) from motorcycles) as motorcycles,
      (
        select count(*)
        from service_cases
        where status in ('OPEN','IN_PROGRESS')
      ) as active_cases,
      (
        select count(*)
        from service_cases
        where status='READY_FOR_DELIVERY'
      ) as ready
  `);

  res.json(result.rows[0]);
});

/* =========================
   CUSTOMERS
========================= */

app.get("/api/customers", async (_req, res) => {
  const result = await pool.query(
    "select * from customers order by created_at desc"
  );

  res.json(result.rows);
});

app.post("/api/customers", async (req, res) => {
  const { name, phone, notes } = req.body;

  if (!name || !phone) {
    return res.status(400).json({
      error: "name and phone are required",
    });
  }

  const result = await pool.query(
    `
    insert into customers
      (name, phone, notes)
    values
      ($1,$2,$3)
    returning *
    `,
    [
      name,
      phone,
      notes ?? null,
    ]
  );

  res.status(201).json({
    customer: result.rows[0],
  });
});

/* =========================
   MOTORCYCLES
========================= */

app.get("/api/motorcycles", async (_req, res) => {
  const result = await pool.query(
    "select * from motorcycles order by created_at desc"
  );

  res.json(result.rows);
});

app.post("/api/motorcycles", async (req, res) => {
  const {
    customer_id,
    plate,
    brand,
    model,
    year,
    color,
    vin,
    mileage,
  } = req.body;

  if (!customer_id || !plate) {
    return res.status(400).json({
      error: "customer_id and plate are required",
    });
  }

  const result = await pool.query(
    `
    insert into motorcycles
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
    values
      ($1,$2,$3,$4,$5,$6,$7,$8)
    returning *
    `,
    [
      customer_id,
      plate,
      brand,
      model,
      year ?? null,
      color,
      vin,
      mileage ?? 0,
    ]
  );

  res.status(201).json({
    motorcycle: result.rows[0],
  });
});

/* =========================
   CASES
========================= */

app.get("/api/cases", async (_req, res) => {
  const result = await pool.query(`
    select
      sc.*,
      c.name customer_name,
      m.plate,
      m.brand,
      m.model
    from service_cases sc
    join customers c
      on c.id = sc.customer_id
    join motorcycles m
      on m.id = sc.motorcycle_id
    order by sc.created_at desc
  `);

  res.json(result.rows);
});

app.post("/api/cases", async (req, res) => {
  const {
    customer_id,
    motorcycle_id,
    complaint,
    diagnosis,
    priority,
  } = req.body;

  if (
    !customer_id ||
    !motorcycle_id ||
    !complaint
  ) {
    return res.status(400).json({
      error:
        "customer_id, motorcycle_id and complaint are required",
    });
  }

  const result = await pool.query(
    `
    insert into service_cases
      (
        customer_id,
        motorcycle_id,
        complaint,
        diagnosis,
        priority
      )
    values
      ($1,$2,$3,$4,$5)
    returning *
    `,
    [
      customer_id,
      motorcycle_id,
      complaint,
      diagnosis ?? null,
      priority ?? "NORMAL",
    ]
  );

  res.status(201).json({
    case: result.rows[0],
  });
});

/* =========================
   START
========================= */

async function start() {
  try {
    await ensureAuthTables();

    app.listen(port, "0.0.0.0", () => {
      console.log(
        `MotoClinic API running on 0.0.0.0:${port}`
      );
    });
  } catch (error) {
    console.error(
      "MotoClinic API failed to start:",
      error
    );

    process.exit(1);
  }
}

start();
