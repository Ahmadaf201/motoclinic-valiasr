-- Moto Clinic Valiasr Database v0.1

CREATE TABLE customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE motorcycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    brand TEXT NOT NULL,
    model TEXT,
    year INTEGER,
    color TEXT,
    plate_number TEXT,
    engine_number TEXT,
    chassis_number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id)
        REFERENCES customers(id)
        ON DELETE CASCADE
);

CREATE TABLE technicians (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    specialty TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE service_cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    motorcycle_id INTEGER NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,

    FOREIGN KEY (customer_id)
        REFERENCES customers(id),

    FOREIGN KEY (motorcycle_id)
        REFERENCES motorcycles(id)
);

CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    technician_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    estimated_cost INTEGER DEFAULT 0,
    actual_cost INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,

    FOREIGN KEY (case_id)
        REFERENCES service_cases(id)
        ON DELETE CASCADE,

    FOREIGN KEY (technician_id)
        REFERENCES technicians(id)
);

CREATE TABLE estimates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    total_amount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (case_id)
        REFERENCES service_cases(id)
        ON DELETE CASCADE
);

CREATE TABLE approvals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    estimate_id INTEGER NOT NULL,
    approved INTEGER NOT NULL DEFAULT 0,
    approved_at DATETIME,
    notes TEXT,

    FOREIGN KEY (estimate_id)
        REFERENCES estimates(id)
        ON DELETE CASCADE
);

CREATE TABLE invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    invoice_number TEXT UNIQUE NOT NULL,
    subtotal INTEGER NOT NULL DEFAULT 0,
    discount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    paid_amount INTEGER NOT NULL DEFAULT 0,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (case_id)
        REFERENCES service_cases(id)
);

CREATE INDEX idx_customers_phone
ON customers(phone);

CREATE INDEX idx_motorcycles_customer
ON motorcycles(customer_id);

CREATE INDEX idx_cases_customer
ON service_cases(customer_id);

CREATE INDEX idx_cases_motorcycle
ON service_cases(motorcycle_id);

CREATE INDEX idx_tasks_case
ON tasks(case_id);

CREATE INDEX idx_tasks_technician
ON tasks(technician_id);
