import express from "express";
import cors from "cors";
import { Pool } from "pg";

const app = express();
app.use(cors());
app.use(express.json());

const port = Number(process.env.API_PORT || 4000);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ ok: true, service: "motoclinic-api" });
  } catch {
    res.status(503).json({ ok: false, service: "motoclinic-api", database: false });
  }
});

app.get("/api/dashboard", async (_req, res) => {
  const result = await pool.query(`
    select
      (select count(*) from customers) as customers,
      (select count(*) from motorcycles) as motorcycles,
      (select count(*) from service_cases where status in ('OPEN','IN_PROGRESS')) as active_cases,
      (select count(*) from service_cases where status='READY_FOR_DELIVERY') as ready
  `);
  res.json(result.rows[0]);
});

app.get("/api/customers", async (_req, res) => {
  const result = await pool.query("select * from customers order by created_at desc");
  res.json(result.rows);
});

app.post("/api/customers", async (req, res) => {
  const { name, phone, notes } = req.body;
  if (!name || !phone) return res.status(400).json({ error: "name and phone are required" });
  const result = await pool.query(
    "insert into customers(name, phone, notes) values($1,$2,$3) returning *",
    [name, phone, notes ?? null]
  );
  res.status(201).json(result.rows[0]);
});

app.get("/api/motorcycles", async (_req, res) => {
  const result = await pool.query("select * from motorcycles order by created_at desc");
  res.json(result.rows);
});

app.post("/api/motorcycles", async (req, res) => {
  const { customer_id, plate, brand, model, year, color, vin, mileage } = req.body;
  if (!customer_id || !plate) return res.status(400).json({ error: "customer_id and plate are required" });
  const result = await pool.query(
    `insert into motorcycles(customer_id,plate,brand,model,year,color,vin,mileage)
     values($1,$2,$3,$4,$5,$6,$7,$8) returning *`,
    [customer_id, plate, brand, model, year ?? null, color, vin, mileage ?? 0]
  );
  res.status(201).json(result.rows[0]);
});

app.get("/api/cases", async (_req, res) => {
  const result = await pool.query(`
    select sc.*, c.name customer_name, m.plate, m.brand, m.model
    from service_cases sc
    join customers c on c.id=sc.customer_id
    join motorcycles m on m.id=sc.motorcycle_id
    order by sc.created_at desc
  `);
  res.json(result.rows);
});

app.post("/api/cases", async (req, res) => {
  const { customer_id, motorcycle_id, complaint, diagnosis, priority } = req.body;
  if (!customer_id || !motorcycle_id || !complaint)
    return res.status(400).json({ error: "customer_id, motorcycle_id and complaint are required" });
  const result = await pool.query(
    `insert into service_cases(customer_id,motorcycle_id,complaint,diagnosis,priority)
     values($1,$2,$3,$4,$5) returning *`,
    [customer_id, motorcycle_id, complaint, diagnosis ?? null, priority ?? "NORMAL"]
  );
  res.status(201).json(result.rows[0]);
});

app.listen(port, () => console.log(`MotoClinic API listening on ${port}`));
