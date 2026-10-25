-- Pandit Babulal Ratanlal : schema.sql
-- Supabase Dashboard > SQL Editor me pehle yeh file chalayein, phir rls-policies.sql

create extension if not exists pgcrypto;

-- updated_at apne aap badalne ka trigger
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end; $$ language plpgsql;

-- 1) profiles : sirf owner
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'owner' check (role = 'owner'),
  created_at timestamptz not null default now()
);

-- 2) products
create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  category text,
  unit text not null check (unit in ('kg','gram','piece','box')),
  selling_price numeric(12,2) not null check (selling_price >= 0),
  cost_price numeric(12,2) check (cost_price >= 0),
  min_stock numeric(12,3) check (min_stock >= 0),
  is_active boolean not null default true,
  is_demo boolean not null default false,   -- demo data alag pehchan ke liye
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index products_name_uq on products (lower(trim(name)));
create trigger products_upd before update on products for each row execute function set_updated_at();

-- 3) sales : product ka naam aur rate us din ka "snapshot" hai,
--    isliye baad me product ka price badle to purane sales nahi badlenge.
--    total yahan store nahi hota; view sales_with_total me nikalta hai.
create table sales (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete restrict,
  product_name text not null check (length(trim(product_name)) > 0),
  sale_date date not null,                       -- Indian business date
  sold_at timestamptz,                           -- sirf transaction ke liye
  entry_type text not null default 'daily_summary'
    check (entry_type in ('transaction','daily_summary')),
  quantity numeric(12,3) not null check (quantity > 0),
  unit text not null check (unit in ('kg','gram','piece','box')),
  rate numeric(12,2) not null check (rate >= 0),
  payment_method text not null default 'cash'
    check (payment_method in ('cash','upi','card','other')),
  note text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sales_date_idx on sales (sale_date);
create index sales_product_date_idx on sales (product_id, sale_date);
create index sales_payment_idx on sales (payment_method);
create trigger sales_upd before update on sales for each row execute function set_updated_at();

create view sales_with_total with (security_invoker = true) as
  select s.*, round(s.quantity * s.rate, 2) as total_amount from sales s;

-- 4) expenses (sales aur stock se bilkul alag)
create table expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category text not null check (category in (
    'Milk and khoya','Sugar','Ghee and oil','Dry fruits','Other ingredients',
    'Packaging','Staff salary','Electricity and utilities','Rent','Transport',
    'Repairs and miscellaneous')),
  description text not null check (length(trim(description)) > 0),
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'cash'
    check (payment_method in ('cash','upi','card','other')),
  note text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_date_idx on expenses (expense_date);
create index expenses_cat_idx on expenses (category, expense_date);
create trigger expenses_upd before update on expenses for each row execute function set_updated_at();

-- 5) daily_stock : roz ka stock + production + waste (production_entries ki jagah yahin)
--    Formula: expected_closing = opening + produced + adjustment - sold - waste
--    (adjustment +/- ho sakta hai: return, galti sudhar)
--    difference = closing_actual - expected_closing  (0 ho to hisaab theek)
create table daily_stock (
  id uuid primary key default gen_random_uuid(),
  stock_date date not null,
  product_id uuid not null references products(id) on delete restrict,
  opening_stock numeric(12,3) not null default 0 check (opening_stock >= 0),
  produced_qty numeric(12,3) not null default 0 check (produced_qty >= 0),
  waste_qty numeric(12,3) not null default 0 check (waste_qty >= 0),
  adjustment_qty numeric(12,3) not null default 0,
  closing_actual numeric(12,3) check (closing_actual >= 0),
  stockout boolean not null default false,       -- din me maal khatam hua?
  stockout_note text,
  note text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (stock_date, product_id)
);
create index daily_stock_date_idx on daily_stock (stock_date);
create trigger daily_stock_upd before update on daily_stock for each row execute function set_updated_at();

-- Note: sold quantity us din ki sales se aata hai. Stock-tracked product ki
-- sales usi unit me darj karein jo product ki unit hai.
create view stock_reconciliation with (security_invoker = true) as
  select d.*, p.name as product_name, p.unit, p.min_stock,
    coalesce((select sum(s.quantity) from sales s
              where s.product_id = d.product_id and s.sale_date = d.stock_date), 0) as sold_qty,
    d.opening_stock + d.produced_qty + d.adjustment_qty - d.waste_qty
      - coalesce((select sum(s.quantity) from sales s
                  where s.product_id = d.product_id and s.sale_date = d.stock_date), 0) as expected_closing
  from daily_stock d join products p on p.id = d.product_id;

-- OPTIONAL demo data (baad me: delete from products where is_demo;)
-- insert into products (name, category, unit, selling_price, is_demo) values
--  ('Peda','Mithai','kg',480,true),('Laddu','Mithai','kg',420,true),
--  ('Barfi','Mithai','kg',500,true),('Gulab Jamun','Mithai','piece',20,true),
--  ('Rasgulla','Mithai','piece',18,true),('Kaju Katli','Dry fruit mithai','kg',900,true);
