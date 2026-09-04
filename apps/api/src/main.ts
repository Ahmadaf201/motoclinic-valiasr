import express from "express";
import cors from "cors";
import { Pool } from "pg";

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

const PRIORITIES = [
  "LOW",
  "NORMAL",
  "HIGH",
  "URGENT",
];

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

/* =========================
   HEALTH
========================= */

app.get("/api/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");

    res.json({
      ok: true,
      service: "motoclinic-api",
      version: "0.6.0",
      database: "connected",
    });
  } catch (error) {
    console.error("HEALTH ERROR:", error);

    res.status(500).json({
      ok: false,
      service: "motoclinic-api",
      version: "0.6.0",
      database: "error",
    });
  }
});

app.get("/api", (_req, res) => {
  res.json({
    ok: true,
    service: "motoclinic-api",
    version: "0.6.0",
  });
});

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
      customers: customers.rows[0].count,
      motorcycles: motorcycles.rows[0].count,
      activeCases: activeCases.rows[0].count,
      revenue: Number(revenue.rows[0].total || 0),
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

app.get("/api/cases", async (_req, res) => {
  try {
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

    res.json(result.rows);
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

    const complaint = clean(
      req.body?.complaint
    );

    const diagnosis = clean(
      req.body?.diagnosis
    );

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

app.get("/api/cases/:caseId", async (req, res) => {
  try {
    const result = await pool.query(
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
});

/* =========================
   CHANGE CASE STATUS
   POST + PATCH
========================= */

async function changeCaseStatus(
  req: express.Request,
  res: express.Response
) {
  try {
    const caseId = clean(
      req.params.caseId
    );

    const status =
      normalizeStatus(
        req.body?.status
      );

    console.log(
      "[STATUS]",
      caseId,
      status
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
        SELECT id, status
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

    console.log(
      "[STATUS UPDATED]",
      result.rows[0].id,
      result.rows[0].status
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
   SERVER
========================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `MotoClinic API running on 0.0.0.0:${PORT}`
    );
  }
);
