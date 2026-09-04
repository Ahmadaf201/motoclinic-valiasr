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

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      service: "motoclinic-api",
      version: "0.2.0",
      database: "connected"
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      service: "motoclinic-api",
      database: "disconnected"
    });
  }
});

app.get("/api", (_req, res) => {
  res.json({
    name: "موتو کلینیک ولیعصر(عج)",
    message: "سیستم مدیریت هوشمند تعمیرگاه موتورسیکلت"
  });
});

app.get("/api/dashboard", async (_req, res) => {
  try {
    const customers = await pool.query(
      "SELECT COUNT(*)::int AS count FROM customers"
    );

    const motorcycles = await pool.query(
      "SELECT COUNT(*)::int AS count FROM motorcycles"
    );

    const activeCases = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM service_cases
       WHERE status NOT IN ('CLOSED', 'COMPLETED')`
    );

    const revenue = await pool.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS total
       FROM payments`
    );

    res.json({
      customers: customers.rows[0].count,
      motorcycles: motorcycles.rows[0].count,
      activeCases: activeCases.rows[0].count,
      revenue: Number(revenue.rows[0].total)
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "خطا در دریافت اطلاعات داشبورد"
    });
  }
});

app.get("/api/customers", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, phone, address, notes, created_at
       FROM customers
       ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "خطا در دریافت مشتریان"
    });
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    const { name, phone, address, notes } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        error: "نام مشتری الزامی است."
      });
    }

    const result = await pool.query(
      `INSERT INTO customers
       (name, phone, address, notes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, phone, address, notes, created_at`,
      [
        String(name).trim(),
        phone ? String(phone).trim() : "",
        address ? String(address).trim() : null,
        notes ? String(notes).trim() : null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "خطا در ثبت مشتری"
    });
  }
});

const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, () => {
  console.log(`MotoClinic API running on port ${PORT}`);
});
