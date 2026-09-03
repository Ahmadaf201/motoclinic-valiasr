const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const dbPath = process.env.DB_PATH || path.join(__dirname, "../motoclinic.db");
const db = new Database(dbPath);
const fs = require("fs");

const schemaPath = path.join(__dirname, "../../../packages/db/schema.sql");

if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);
}

db.pragma("foreign_keys = ON");

// ---------- Health ----------
app.get("/api", (req, res) => {
  res.json({
    name: "موتو کلینیک ولیعصر (عج)",
    status: "ok",
    version: "0.1.0"
  });
});

// ---------- Customers ----------

app.get("/api/customers", (req, res) => {
  const customers = db
    .prepare(`
      SELECT *
      FROM customers
      ORDER BY id DESC
    `)
    .all();

  res.json(customers);
});

app.post("/api/customers", (req, res) => {
  const { name, phone, address, notes } = req.body;

  if (!name) {
    return res.status(400).json({
      error: "نام مشتری الزامی است"
    });
  }

  const result = db
    .prepare(`
      INSERT INTO customers
      (name, phone, address, notes)
      VALUES (?, ?, ?, ?)
    `)
    .run(
      name,
      phone || null,
      address || null,
      notes || null
    );

  const customer = db
    .prepare(`
      SELECT *
      FROM customers
      WHERE id = ?
    `)
    .get(result.lastInsertRowid);

  res.status(201).json(customer);
});

// ---------- Motorcycles ----------

app.get("/api/motorcycles", (req, res) => {
  const motorcycles = db
    .prepare(`
      SELECT
        motorcycles.*,
        customers.name AS customer_name,
        customers.phone AS customer_phone
      FROM motorcycles
      JOIN customers
        ON customers.id = motorcycles.customer_id
      ORDER BY motorcycles.id DESC
    `)
    .all();

  res.json(motorcycles);
});

app.post("/api/motorcycles", (req, res) => {
  const {
    customer_id,
    brand,
    model,
    year,
    color,
    plate_number,
    engine_number,
    chassis_number
  } = req.body;

  if (!customer_id || !brand) {
    return res.status(400).json({
      error: "مشتری و برند موتورسیکلت الزامی هستند"
    });
  }

  const customer = db
    .prepare("SELECT id FROM customers WHERE id = ?")
    .get(customer_id);

  if (!customer) {
    return res.status(404).json({
      error: "مشتری پیدا نشد"
    });
  }

  const result = db
    .prepare(`
      INSERT INTO motorcycles
      (
        customer_id,
        brand,
        model,
        year,
        color,
        plate_number,
        engine_number,
        chassis_number
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      customer_id,
      brand,
      model || null,
      year || null,
      color || null,
      plate_number || null,
      engine_number || null,
      chassis_number || null
    );

  const motorcycle = db
    .prepare(`
      SELECT *
      FROM motorcycles
      WHERE id = ?
    `)
    .get(result.lastInsertRowid);

  res.status(201).json(motorcycle);
});

// ---------- Service Cases ----------

app.get("/api/cases", (req, res) => {
  const cases = db
    .prepare(`
      SELECT
        service_cases.*,
        customers.name AS customer_name,
        motorcycles.brand AS motorcycle_brand,
        motorcycles.model AS motorcycle_model
      FROM service_cases
      JOIN customers
        ON customers.id = service_cases.customer_id
      JOIN motorcycles
        ON motorcycles.id = service_cases.motorcycle_id
      ORDER BY service_cases.id DESC
    `)
    .all();

  res.json(cases);
});

app.post("/api/cases", (req, res) => {
  const {
    customer_id,
    motorcycle_id,
    description
  } = req.body;

  if (!customer_id || !motorcycle_id) {
    return res.status(400).json({
      error: "مشتری و موتورسیکلت الزامی هستند"
    });
  }

  const motorcycle = db
    .prepare(`
      SELECT *
      FROM motorcycles
      WHERE id = ?
      AND customer_id = ?
    `)
    .get(motorcycle_id, customer_id);

  if (!motorcycle) {
    return res.status(400).json({
      error: "موتورسیکلت متعلق به این مشتری نیست"
    });
  }

  const result = db
    .prepare(`
      INSERT INTO service_cases
      (
        customer_id,
        motorcycle_id,
        description
      )
      VALUES (?, ?, ?)
    `)
    .run(
      customer_id,
      motorcycle_id,
      description || ""
    );

  const serviceCase = db
    .prepare(`
      SELECT *
      FROM service_cases
      WHERE id = ?
    `)
    .get(result.lastInsertRowid);

  res.status(201).json(serviceCase);
});

// ---------- Dashboard ----------

app.get("/api/dashboard", (req, res) => {
  const customers = db
    .prepare("SELECT COUNT(*) AS count FROM customers")
    .get().count;

  const motorcycles = db
    .prepare("SELECT COUNT(*) AS count FROM motorcycles")
    .get().count;

  const activeCases = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM service_cases
      WHERE status NOT IN ('completed', 'cancelled')
    `)
    .get().count;

  const revenue = db
    .prepare(`
      SELECT COALESCE(SUM(paid_amount), 0) AS total
      FROM invoices
    `)
    .get().total;

  res.json({
    customers,
    motorcycles,
    activeCases,
    revenue
  });
});

// ---------- Start ----------

app.listen(PORT, () => {
  console.log(
    `Moto Clinic API running on port ${PORT}`
  );
});
