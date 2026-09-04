import express from "express";
import cors from "cors";
import { Pool } from "pg";

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});

const PORT = Number(process.env.PORT || 10000);

const CASE_STATUSES = [
  "OPEN",
  "DIAGNOSIS",
  "WAITING_APPROVAL",
  "IN_PROGRESS",
  "WAITING_PARTS",
  "READY",
  "COMPLETED",
  "CLOSED"
];

const PRIORITIES = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT"
];

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      service: "motoclinic-api",
      version: "0.5.0",
      database: "connected"
    });

  } catch (error) {

    res.status(500).json({
      ok: false,
      service: "motoclinic-api",
      version: "0.5.0",
      database: "disconnected",
      error: error instanceof Error ? error.message : "Database error"
    });
  }
});

app.get("/api", (_req, res) => {
  res.json({
    ok: true,
    service: "motoclinic-api",
    version: "0.5.0"
  });
});

/* =========================
   DASHBOARD
========================= */

app.get("/api/dashboard", async (_req, res) => {

  try {

    const customers =
      await pool.query("SELECT COUNT(*)::int AS count FROM customers");

    const motorcycles =
      await pool.query("SELECT COUNT(*)::int AS count FROM motorcycles");

    const activeCases =
      await pool.query(`
        SELECT COUNT(*)::int AS count
        FROM service_cases
        WHERE status NOT IN ('COMPLETED', 'CLOSED')
      `);

    const revenue =
      await pool.query(`
        SELECT COALESCE(SUM(amount), 0)::numeric AS total
        FROM payments
      `);

    res.json({
      customers: customers.rows[0].count,
      motorcycles: motorcycles.rows[0].count,
      activeCases: activeCases.rows[0].count,
      revenue: revenue.rows[0].total,
      ready: true
    });

  } catch (error) {

    res.status(500).json({
      error: error instanceof Error ? error.message : "Dashboard error"
    });
  }
});

/* =========================
   CUSTOMERS
========================= */

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

    res.status(500).json({
      error: error instanceof Error ? error.message : "Customers error"
    });
  }
});

app.post("/api/customers", async (req, res) => {

  try {

    const {
      name,
      phone,
      address = "",
      notes = ""
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        error: "نام و شماره تماس الزامی است"
      });
    }

    const result = await pool.query(`
      INSERT INTO customers
        (name, phone, address, notes)
      VALUES
        ($1, $2, $3, $4)
      RETURNING *
    `, [
      name,
      phone,
      address,
      notes
    ]);

    res.status(201).json(result.rows[0]);

  } catch (error) {

    res.status(500).json({
      error: error instanceof Error ? error.message : "Create customer error"
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
        c.name AS customer_name
      FROM motorcycles m
      JOIN customers c
        ON c.id = m.customer_id
      ORDER BY m.created_at DESC
    `);

    res.json(result.rows);

  } catch (error) {

    res.status(500).json({
      error: error instanceof Error ? error.message : "Motorcycles error"
    });
  }
});

app.get("/api/motorcycles/customer/:customerId", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT *
      FROM motorcycles
      WHERE customer_id = $1
      ORDER BY created_at DESC
    `, [req.params.customerId]);

    res.json(result.rows);

  } catch (error) {

    res.status(500).json({
      error: error instanceof Error ? error.message : "Customer motorcycles error"
    });
  }
});

app.post("/api/motorcycles", async (req, res) => {

  try {

    const {
      customer_id,
      plate,
      brand = "",
      model = "",
      year = null,
      color = "",
      vin = "",
      mileage = 0
    } = req.body;

    if (!customer_id || !plate) {
      return res.status(400).json({
        error: "مشتری و پلاک الزامی هستند"
      });
    }

    const customer =
      await pool.query(
        "SELECT id FROM customers WHERE id = $1",
        [customer_id]
      );

    if (!customer.rowCount) {
      return res.status(400).json({
        error: "مشتری پیدا نشد"
      });
    }

    const result = await pool.query(`
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
    `, [
      customer_id,
      plate,
      brand,
      model,
      year,
      color,
      vin,
      mileage
    ]);

    res.status(201).json(result.rows[0]);

  } catch (error) {

    res.status(500).json({
      error: error instanceof Error ? error.message : "Create motorcycle error"
    });
  }
});

/* =========================
   SERVICE CASES
========================= */

app.get("/api/cases", async (_req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        sc.*,
        c.name AS customer_name,
        m.plate,
        m.brand,
        m.model
      FROM service_cases sc
      JOIN customers c
        ON c.id = sc.customer_id
      JOIN motorcycles m
        ON m.id = sc.motorcycle_id
      ORDER BY sc.created_at DESC
    `);

    res.json(result.rows);

  } catch (error) {

    res.status(500).json({
      error: error instanceof Error ? error.message : "Cases error"
    });
  }
});

app.post("/api/cases", async (req, res) => {

  try {

    const {
      customer_id,
      motorcycle_id,
      complaint,
      diagnosis = "",
      priority = "NORMAL"
    } = req.body;

    if (!customer_id || !motorcycle_id || !complaint) {
      return res.status(400).json({
        error: "مشتری، موتورسیکلت و شرح مشکل الزامی هستند"
      });
    }

    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({
        error: "اولویت نامعتبر است"
      });
    }

    const motorcycle =
      await pool.query(`
        SELECT id
        FROM motorcycles
        WHERE id = $1
          AND customer_id = $2
      `, [
        motorcycle_id,
        customer_id
      ]);

    if (!motorcycle.rowCount) {
      return res.status(400).json({
        error: "این موتورسیکلت متعلق به مشتری انتخاب‌شده نیست"
      });
    }

    const result = await pool.query(`
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
        ($1,$2,$3,$4,'OPEN',$5)
      RETURNING *
    `, [
      customer_id,
      motorcycle_id,
      complaint,
      diagnosis,
      priority
    ]);

    res.status(201).json(result.rows[0]);

  } catch (error) {

    res.status(500).json({
      error: error instanceof Error ? error.message : "Create case error"
    });
  }
});

/* =========================
   SINGLE CASE
========================= */

app.get("/api/cases/:caseId", async (req, res) => {

  try {

    const result = await pool.query(`
      SELECT
        sc.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.address AS customer_address,
        m.plate,
        m.brand,
        m.model,
        m.year,
        m.color,
        m.vin,
        m.mileage
      FROM service_cases sc
      JOIN customers c
        ON c.id = sc.customer_id
      JOIN motorcycles m
        ON m.id = sc.motorcycle_id
      WHERE sc.id = $1
    `, [req.params.caseId]);

    if (!result.rowCount) {
      return res.status(404).json({
        error: "پرونده پیدا نشد"
      });
    }

    res.json(result.rows[0]);

  } catch (error) {

    res.status(500).json({
      error: error instanceof Error ? error.message : "Case detail error"
    });
  }
});

/* =========================
   CHANGE CASE STATUS
========================= */

app.patch("/api/cases/:caseId/status", async (req, res) => {

  try {

    const caseId = req.params.caseId;

    const status =
      typeof req.body?.status === "string"
        ? req.body.status.trim().toUpperCase()
        : "";

    if (!status) {
      return res.status(400).json({
        error: "وضعیت ارسال نشده است"
      });
    }

    if (!CASE_STATUSES.includes(status)) {
      return res.status(400).json({
        error: "وضعیت پرونده نامعتبر است",
        allowed: CASE_STATUSES
      });
    }

    const existing =
      await pool.query(`
        SELECT id
        FROM service_cases
        WHERE id = $1
      `, [caseId]);

    if (!existing.rowCount) {
      return res.status(404).json({
        error: "پرونده پیدا نشد"
      });
    }

    const result =
      await pool.query(`
        UPDATE service_cases
        SET
          status = $1,
          closed_at =
            CASE
              WHEN $1 IN ('COMPLETED', 'CLOSED')
                THEN COALESCE(closed_at, NOW())
              ELSE NULL
            END
        WHERE id = $2
        RETURNING *
      `, [
        status,
        caseId
      ]);

    return res.json({
      ok: true,
      message: "وضعیت پرونده با موفقیت تغییر کرد",
      case: result.rows[0]
    });

  } catch (error) {

    console.error("CHANGE CASE STATUS ERROR:", error);

    return res.status(500).json({
      ok: false,
      error: error instanceof Error
        ? error.message
        : "Change case status error"
    });
  }
});

/* =========================
   SERVER
========================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `MotoClinic API v0.5.0 running on 0.0.0.0:${PORT}`
  );
});
