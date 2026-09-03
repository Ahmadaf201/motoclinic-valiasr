create extension if not exists pgcrypto;

create table if not exists customers (
 id uuid primary key default gen_random_uuid(),
 name varchar(120) not null,
 phone varchar(30) not null,
 notes text,
 created_at timestamptz not null default now()
);

create table if not exists motorcycles (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references customers(id) on delete cascade,
 plate varchar(40) not null,
 brand varchar(80),
 model varchar(80),
 year int,
 color varchar(40),
 vin varchar(80),
 mileage int not null default 0,
 created_at timestamptz not null default now()
);

create table if not exists technicians (
 id uuid primary key default gen_random_uuid(),
 name varchar(120) not null,
 phone varchar(30),
 specialty varchar(120),
 active boolean not null default true,
 created_at timestamptz not null default now()
);

create table if not exists service_cases (
 id uuid primary key default gen_random_uuid(),
 customer_id uuid not null references customers(id),
 motorcycle_id uuid not null references motorcycles(id),
 complaint text not null,
 diagnosis text,
 status varchar(40) not null default 'OPEN',
 priority varchar(20) not null default 'NORMAL',
 opened_at timestamptz not null default now(),
 closed_at timestamptz,
 created_at timestamptz not null default now()
);

create table if not exists tasks (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references service_cases(id) on delete cascade,
 technician_id uuid references technicians(id),
 title varchar(200) not null,
 description text,
 status varchar(30) not null default 'TODO',
 labor_cost numeric(12,2) not null default 0,
 started_at timestamptz,
 completed_at timestamptz
);

create table if not exists parts (
 id uuid primary key default gen_random_uuid(),
 name varchar(160) not null,
 sku varchar(80),
 stock_qty int not null default 0,
 unit_cost numeric(12,2) not null default 0,
 sale_price numeric(12,2) not null default 0,
 created_at timestamptz not null default now()
);

create table if not exists case_parts (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references service_cases(id) on delete cascade,
 part_id uuid not null references parts(id),
 quantity int not null default 1,
 unit_price numeric(12,2) not null
);

create table if not exists estimates (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null unique references service_cases(id) on delete cascade,
 subtotal numeric(12,2) not null default 0,
 discount numeric(12,2) not null default 0,
 total numeric(12,2) not null default 0,
 status varchar(30) not null default 'DRAFT',
 approved_at timestamptz,
 created_at timestamptz not null default now()
);

create table if not exists payments (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references service_cases(id),
 amount numeric(12,2) not null,
 method varchar(30) not null,
 paid_at timestamptz not null default now(),
 reference varchar(120)
);

create table if not exists case_notes (
 id uuid primary key default gen_random_uuid(),
 case_id uuid not null references service_cases(id) on delete cascade,
 body text not null,
 created_at timestamptz not null default now()
);

create index if not exists idx_motorcycles_customer on motorcycles(customer_id);
create index if not exists idx_cases_status on service_cases(status);
create index if not exists idx_tasks_case on tasks(case_id);
create index if not exists idx_payments_case on payments(case_id);

insert into customers(name,phone,notes)
select 'نمونه مشتری','09120000000','داده نمونه اولیه'
where not exists (select 1 from customers);

insert into motorcycles(customer_id,plate,brand,model,mileage)
select c.id,'TEST-01','Honda','CG 125',10000
from customers c
where c.phone='09120000000'
and not exists (select 1 from motorcycles m where m.plate='TEST-01');

insert into service_cases(customer_id,motorcycle_id,complaint,diagnosis)
select c.id,m.id,'سرویس اولیه و بررسی کامل','پرونده نمونه برای تست سیستم'
from customers c join motorcycles m on m.customer_id=c.id
where c.phone='09120000000' and m.plate='TEST-01'
and not exists (select 1 from service_cases s where s.complaint='سرویس اولیه و بررسی کامل');
