import express from "express";
import cors from "cors";
import { Pool } from "pg";

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// ─────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      service: "motoclinic-api",
      version: "0.4.0",
      database: "connected",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      service: "motoclinic-api",
      version: "0.4.0",
      database: "disconnected",
    });
  }
});

// ─────────────────────────────────────────────
// API INFO
// ─────────────────────────────────────────────

app.get("/api", (_req, res) => {
  res.json({
    name: "موتو کلینیک ولیعصر(عج)",
    message: "سیستم مدیریت هوشمند تعمیرگاه موتورسیکلت",
    version: "0.4.0",
  });
});

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────

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
      WHERE status NOT IN ('CLOSED', 'COMPLETED')
    `);

    const revenue = await pool.query(`
      SELECT COALESCE(SUM(amount), 0)::numeric AS total
      FROM payments
    `);

    const ready = await pool.query(`
      SELECT COUNT(*)::int AS count
      FROM service_cases
      WHERE status = 'READY'
    `);

    res.json({
      customers: customers.rows[0].count,
      motorcycles: motorcycles.rows[0].count,
      activeCases: activeCases.rows[0].count,
      revenue: Number(revenue.rows[0].total),
      ready: ready.rows[0].count,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "خطا در دریافت اطلاعات داشبورد",
    });
  }
});

// ─────────────────────────────────────────────
// CUSTOMERS
// ─────────────────────────────────────────────

app.get("/api/customers", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        phone,
        address,
        notes,
        created_at
      FROM customers
      ORDER BY created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "خطا در دریافت مشتریان",
    });
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    const { name, phone, address, notes } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        error: "نام مشتری الزامی است.",
      });
    }

    const result = await pool.query(
      `
      INSERT INTO customers
        (name, phone, address, notes)
      VALUES
        ($1, $2, $3, $4)
      RETURNING
        id,
        name,
        phone,
        address,
        notes,
        created_at
      `,
      [
        String(name).trim(),
        phone ? String(phone).trim() : "",
        address ? String(address).trim() : null,
        notes ? String(notes).trim() : null,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "خطا در ثبت مشتری",
    });
  }
});

// ─────────────────────────────────────────────
// MOTORCYCLES
// ─────────────────────────────────────────────

app.get("/api/motorcycles", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        m.id,
        m.customer_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        m.plate,
        m.brand,
        m.model,
        m.year,
        m.color,
        m.vin,
        m.mileage,
        m.created_at
      FROM motorcycles m
      JOIN customers c
        ON c.id = m.customer_id
      ORDER BY m.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "خطا در دریافت موتورسیکلت‌ها",
    });
  }
});

app.get("/api/customers/:customerId/motorcycles", async (req, res) => {
  try {
    const { customerId } = req.params;

    const result = await pool.query(
      `
      SELECT
        id,
        customer_id,
        plate,
        brand,
        model,
        year,
        color,
        vin,
        mileage,
        created_at
      FROM motorcycles
      WHERE customer_id = $1
      ORDER BY created_at DESC
      `,
      [customerId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "خطا در دریافت موتورسیکلت‌های مشتری",
    });
  }
});

app.post("/api/motorcycles", async (req, res) => {
  try {
    const {
      customerId,
      plate,
      brand,
      model,
      year,
      color,
      vin,
      mileage,
    } = req.body;

    if (!customerId) {
      return res.status(400).json({
        error: "انتخاب مشتری الزامی است.",
      });
    }

    if (!plate || !String(plate).trim()) {
      return res.status(400).json({
        error: "شماره پلاک الزامی است.",
      });
    }

    const customer = await pool.query(
      `
      SELECT id
      FROM customers
      WHERE id = $1
      `,
      [customerId]
    );

    if (customer.rowCount === 0) {
      return res.status(404).json({
        error: "مشتری پیدا نشد.",
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
        ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING
        id,
        customer_id,
        plate,
        brand,
        model,
        year,
        color,
        vin,
        mileage,
        created_at
      `,
      [
        customerId,
        String(plate).trim(),
        brand ? String(brand).trim() : null,
        model ? String(model).trim() : null,
        year ? Number(year) : null,
        color ? String(color).trim() : null,
        vin ? String(vin).trim() : null,
        mileage ? Number(mileage) : 0,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "خطا در ثبت موتورسیکلت",
    });
  }
});

// ─────────────────────────────────────────────
// SERVICE CASES
// ─────────────────────────────────────────────

// دریافت پرونده‌های تعمیر
app.get("/api/cases", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        sc.id,
        sc.customer_id,
        sc.motorcycle_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        m.plate,
        m.brand,
        m.model,
        m.color,
        sc.complaint,
        sc.diagnosis,
        sc.status,
        sc.priority,
        sc.opened_at,
        sc.closed_at,
        sc.created_at
      FROM service_cases sc
      JOIN customers c
        ON c.id = sc.customer_id
      JOIN motorcycles m
        ON m.id = sc.motorcycle_id
      ORDER BY sc.created_at DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "خطا در دریافت پرونده‌های تعمیر",
    });
  }
});

// ثبت پرونده تعمیر
app.post("/api/cases", async (req, res) => {
  try {
    const {
      customerId,
      motorcycleId,
      complaint,
      diagnosis,
      priority,
    } = req.body;

    if (!customerId) {
      return res.status(400).json({
        error: "انتخاب مشتری الزامی است.",
      });
    }

    if (!motorcycleId) {
      return res.status(400).json({
        error: "انتخاب موتورسیکلت الزامی است.",
      });
    }

    if (!complaint || !String(complaint).trim()) {
      return res.status(400).json({
        error: "شرح مشکل الزامی است.",
      });
    }

    const motorcycle = await pool.query(
      `
      SELECT id, customer_id
      FROM motorcycles
      WHERE id = $1
      `,
      [motorcycleId]
    );

    if (motorcycle.rowCount === 0) {
      return res.status(404).json({
        error: "موتورسیکلت پیدا نشد.",
      });
    }

    if (motorcycle.rows[0].customer_id !== customerId) {
      return res.status(400).json({
        error: "این موتورسیکلت متعلق به مشتری انتخاب‌شده نیست.",
      });
    }

    const allowedPriorities = ["LOW", "NORMAL", "HIGH", "URGENT"];
    const selectedPriority = allowedPriorities.includes(priority)
      ? priority
      : "NORMAL";

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
        ($1, $2, $3, $4, 'OPEN', $5)
      RETURNING
        id,
        customer_id,
        motorcycle_id,
        complaint,
        diagnosis,
        status,
        priority,
        opened_at,
        created_at
      `,
      [
        customerId,
        motorcycleId,
        String(complaint).trim(),
        diagnosis ? String(diagnosis).trim() : null,
        selectedPriority,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "خطا در ثبت پرونده تعمیر",
    });
  }
});

// دریافت یک پرونده
app.get("/api/cases/:caseId", async (req, res) => {
  try {
    const { caseId } = req.params;

    const result = await pool.query(
      `
      SELECT
        sc.id,
        sc.customer_id,
        sc.motorcycle_id,
        c.name AS customer_name,
        c.phone AS customer_phone,
        m.plate,
        m.brand,
        m.model,
        m.year,
        m.color,
        m.vin,
        m.mileage,
        sc.complaint,
        sc.diagnosis,
        sc.status,
        sc.priority,
        sc.opened_at,
        sc.closed_at,
        sc.created_at
      FROM service_cases sc
      JOIN customers c
        ON c.id = sc.customer_id
      JOIN motorcycles m
        ON m.id = sc.motorcycle_id
      WHERE sc.id = $1
      `,
      [caseId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "پرونده پیدا نشد.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "خطا در دریافت پرونده",
    });
  }
});

// تغییر وضعیت پرونده
app.patch("/api/cases/:caseId/status", async (req, res) => {
  try {
    const { caseId } = req.params;
    const { status } = req.body;

    const allowedStatuses = [
      "OPEN",
      "DIAGNOSIS",
      "WAITING_APPROVAL",
      "IN_PROGRESS",
      "WAITING_PARTS",
      "READY",
      "COMPLETED",
      "CLOSED",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "وضعیت پرونده نامعتبر است.",
      });
    }

    const result = await pool.query(
      `
      UPDATE service_cases
      SET
        status = $1,
        closed_at =
          CASE
            WHEN $1 IN ('COMPLETED', 'CLOSED')
            THEN COALESCE(closed_at, now())
            ELSE NULL
          END
      WHERE id = $2
      RETURNING
        id,
        status,
        closed_at
      `,
      [status, caseId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: "پرونده پیدا نشد.",
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "خطا در تغییر وضعیت پرونده",
    });
  }
});

// ─────────────────────────────────────────────
// SERVER
// ─────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MotoClinic API running on 0.0.0.0:${PORT}`);
});
