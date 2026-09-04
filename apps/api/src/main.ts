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
      version: "0.3.0",
      database: "connected",
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      service: "motoclinic-api",
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
    version: "0.3.0",
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

    res.json({
      customers: customers.rows[0].count,
      motorcycles: motorcycles.rows[0].count,
      activeCases: activeCases.rows[0].count,
      revenue: Number(revenue.rows[0].total),
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

// دریافت لیست مشتریان
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

// ثبت مشتری
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

// دریافت موتورسیکلت‌ها
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

// دریافت موتورسیکلت‌های یک مشتری
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

// ثبت موتورسیکلت
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

    // بررسی وجود مشتری
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
// SERVER
// ─────────────────────────────────────────────

const PORT = Number(process.env.PORT) || 4000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MotoClinic API running on 0.0.0.0:${PORT}`);
});
