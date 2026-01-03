-- ============================================
-- כספית - מערכת ניהול פיננסי
-- סכמת בסיס נתונים - Supabase
-- ============================================

-- הפעלת UUID
create extension if not exists "uuid-ossp";

-- ============================================
-- טבלת חברות
-- ============================================
create table companies (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  logo_url text,
  address text,
  phone text,
  email text,
  tax_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================
-- טבלת משתמשים (פרופיל מורחב)
-- ============================================
create table users (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  full_name text,
  role text not null check (role in ('admin', 'finance_manager')),
  company_id uuid references companies(id) on delete cascade,
  avatar_url text,
  last_login timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================
-- טבלת קטגוריות
-- ============================================
create table categories (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  color text default '#6366f1',
  icon text default 'folder',
  parent_id uuid references categories(id) on delete set null,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================
-- טבלת ספקים
-- ============================================
create table suppliers (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  tax_id text,
  payment_terms integer default 30,
  notes text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================
-- טבלת לקוחות
-- ============================================
create table customers (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  tax_id text,
  payment_terms integer default 30,
  notes text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================
-- טבלת הכנסות
-- ============================================
create table income (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  category_id uuid references categories(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  amount decimal(15,2) not null,
  date date not null,
  description text,
  invoice_number text,
  payment_status text default 'pending' check (payment_status in ('pending', 'partial', 'paid')),
  payment_date date,
  created_by uuid references users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================
-- טבלת הוצאות
-- ============================================
create table expenses (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  category_id uuid references categories(id) on delete set null,
  supplier_id uuid references suppliers(id) on delete set null,
  amount decimal(15,2) not null,
  date date not null,
  description text,
  invoice_number text,
  payment_status text default 'pending' check (payment_status in ('pending', 'partial', 'paid')),
  due_date date,
  paid_date date,
  is_recurring boolean default false,
  recurring_day integer,
  created_by uuid references users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================
-- טבלת תנועות בנק
-- ============================================
create table bank_transactions (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  bank_name text,
  account_number text,
  date date not null,
  amount decimal(15,2) not null,
  description text,
  balance decimal(15,2),
  matched_type text check (matched_type in ('income', 'expense', null)),
  matched_id uuid,
  import_batch_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================
-- טבלת חשבוניות
-- ============================================
create table invoices (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  type text not null check (type in ('income', 'expense')),
  number text,
  date date not null,
  due_date date,
  amount decimal(15,2) not null,
  vat_amount decimal(15,2) default 0,
  total_amount decimal(15,2) not null,
  supplier_id uuid references suppliers(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  status text default 'pending' check (status in ('pending', 'partial', 'paid', 'cancelled')),
  file_url text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================
-- טבלת תקציבים
-- ============================================
create table budgets (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  category_id uuid references categories(id) on delete cascade not null,
  year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  amount decimal(15,2) not null,
  created_by uuid references users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(company_id, category_id, year, month)
);

-- ============================================
-- טבלת התראות
-- ============================================
create table alerts (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  user_id uuid references users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  severity text default 'info' check (severity in ('info', 'warning', 'critical', 'success')),
  is_read boolean default false,
  related_type text,
  related_id uuid,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================
-- טבלת לוג ייבואים
-- ============================================
create table import_logs (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  user_id uuid references users(id) on delete set null,
  type text not null check (type in ('bank', 'invoice', 'income', 'expense')),
  file_name text,
  records_count integer default 0,
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  errors jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================
-- טבלת הגדרות
-- ============================================
create table settings (
  id uuid default uuid_generate_v4() primary key,
  company_id uuid references companies(id) on delete cascade not null,
  key text not null,
  value jsonb,
  unique(company_id, key)
);

-- ============================================
-- אינדקסים לביצועים
-- ============================================
create index idx_income_company_date on income(company_id, date);
create index idx_expenses_company_date on expenses(company_id, date);
create index idx_bank_transactions_company_date on bank_transactions(company_id, date);
create index idx_categories_company_type on categories(company_id, type);
create index idx_budgets_company_period on budgets(company_id, year, month);
create index idx_alerts_company_user on alerts(company_id, user_id, is_read);

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- הפעלת RLS על כל הטבלאות
alter table companies enable row level security;
alter table users enable row level security;
alter table categories enable row level security;
alter table suppliers enable row level security;
alter table customers enable row level security;
alter table income enable row level security;
alter table expenses enable row level security;
alter table bank_transactions enable row level security;
alter table invoices enable row level security;
alter table budgets enable row level security;
alter table alerts enable row level security;
alter table import_logs enable row level security;
alter table settings enable row level security;

-- פוליסות אבטחה - משתמשים יכולים לראות רק נתונים של החברה שלהם

-- Users
create policy "Users can view own profile" on users
  for select using (auth.uid() = id);

create policy "Users can update own profile" on users
  for update using (auth.uid() = id);

-- Companies
create policy "Users can view their company" on companies
  for select using (
    id in (select company_id from users where id = auth.uid())
  );

-- Categories
create policy "Users can view company categories" on categories
  for select using (
    company_id in (select company_id from users where id = auth.uid())
  );

create policy "Users can insert company categories" on categories
  for insert with check (
    company_id in (select company_id from users where id = auth.uid())
  );

create policy "Users can update company categories" on categories
  for update using (
    company_id in (select company_id from users where id = auth.uid())
  );

create policy "Users can delete company categories" on categories
  for delete using (
    company_id in (select company_id from users where id = auth.uid())
  );

-- Suppliers
create policy "Users can manage company suppliers" on suppliers
  for all using (
    company_id in (select company_id from users where id = auth.uid())
  );

-- Customers
create policy "Users can manage company customers" on customers
  for all using (
    company_id in (select company_id from users where id = auth.uid())
  );

-- Income
create policy "Users can manage company income" on income
  for all using (
    company_id in (select company_id from users where id = auth.uid())
  );

-- Expenses
create policy "Users can manage company expenses" on expenses
  for all using (
    company_id in (select company_id from users where id = auth.uid())
  );

-- Bank Transactions
create policy "Users can manage company bank transactions" on bank_transactions
  for all using (
    company_id in (select company_id from users where id = auth.uid())
  );

-- Invoices
create policy "Users can manage company invoices" on invoices
  for all using (
    company_id in (select company_id from users where id = auth.uid())
  );

-- Budgets
create policy "Users can manage company budgets" on budgets
  for all using (
    company_id in (select company_id from users where id = auth.uid())
  );

-- Alerts
create policy "Users can view own alerts" on alerts
  for select using (
    user_id = auth.uid() or 
    (user_id is null and company_id in (select company_id from users where id = auth.uid()))
  );

create policy "Users can update own alerts" on alerts
  for update using (
    user_id = auth.uid() or 
    (user_id is null and company_id in (select company_id from users where id = auth.uid()))
  );

-- Import Logs
create policy "Users can manage company imports" on import_logs
  for all using (
    company_id in (select company_id from users where id = auth.uid())
  );

-- Settings
create policy "Users can manage company settings" on settings
  for all using (
    company_id in (select company_id from users where id = auth.uid())
  );

-- ============================================
-- פונקציות עזר
-- ============================================

-- פונקציה ליצירת משתמש חדש עם חברה
create or replace function create_user_with_company(
  user_id uuid,
  user_email text,
  user_name text,
  company_name text
) returns uuid as $$
declare
  new_company_id uuid;
begin
  -- יצירת חברה
  insert into companies (name)
  values (company_name)
  returning id into new_company_id;
  
  -- יצירת פרופיל משתמש
  insert into users (id, email, full_name, role, company_id)
  values (user_id, user_email, user_name, 'admin', new_company_id);
  
  -- יצירת קטגוריות ברירת מחדל - הכנסות
  insert into categories (company_id, name, type, color, icon) values
    (new_company_id, 'מכירות', 'income', '#22c55e', 'shopping-cart'),
    (new_company_id, 'שירותים', 'income', '#3b82f6', 'briefcase'),
    (new_company_id, 'עמלות', 'income', '#8b5cf6', 'percent'),
    (new_company_id, 'הכנסות אחרות', 'income', '#6b7280', 'plus-circle');
  
  -- יצירת קטגוריות ברירת מחדל - הוצאות
  insert into categories (company_id, name, type, color, icon) values
    (new_company_id, 'משכורות', 'expense', '#ef4444', 'users'),
    (new_company_id, 'שכירות', 'expense', '#f97316', 'home'),
    (new_company_id, 'ספקים', 'expense', '#eab308', 'truck'),
    (new_company_id, 'שיווק ופרסום', 'expense', '#ec4899', 'megaphone'),
    (new_company_id, 'ציוד ותחזוקה', 'expense', '#14b8a6', 'wrench'),
    (new_company_id, 'חשבונות (חשמל, מים, אינטרנט)', 'expense', '#6366f1', 'zap'),
    (new_company_id, 'ביטוחים', 'expense', '#8b5cf6', 'shield'),
    (new_company_id, 'מיסים ואגרות', 'expense', '#64748b', 'landmark'),
    (new_company_id, 'הוצאות משרד', 'expense', '#0ea5e9', 'clipboard'),
    (new_company_id, 'נסיעות', 'expense', '#f59e0b', 'car'),
    (new_company_id, 'הוצאות אחרות', 'expense', '#6b7280', 'more-horizontal');
  
  return new_company_id;
end;
$$ language plpgsql security definer;

-- פונקציה לחישוב סיכום חודשי
create or replace function get_monthly_summary(
  p_company_id uuid,
  p_year integer,
  p_month integer
) returns table (
  total_income decimal,
  total_expenses decimal,
  net_profit decimal,
  income_count integer,
  expense_count integer
) as $$
begin
  return query
  select
    coalesce((
      select sum(amount) from income
      where company_id = p_company_id
      and extract(year from date) = p_year
      and extract(month from date) = p_month
    ), 0) as total_income,
    coalesce((
      select sum(amount) from expenses
      where company_id = p_company_id
      and extract(year from date) = p_year
      and extract(month from date) = p_month
    ), 0) as total_expenses,
    coalesce((
      select sum(amount) from income
      where company_id = p_company_id
      and extract(year from date) = p_year
      and extract(month from date) = p_month
    ), 0) - coalesce((
      select sum(amount) from expenses
      where company_id = p_company_id
      and extract(year from date) = p_year
      and extract(month from date) = p_month
    ), 0) as net_profit,
    (
      select count(*)::integer from income
      where company_id = p_company_id
      and extract(year from date) = p_year
      and extract(month from date) = p_month
    ) as income_count,
    (
      select count(*)::integer from expenses
      where company_id = p_company_id
      and extract(year from date) = p_year
      and extract(month from date) = p_month
    ) as expense_count;
end;
$$ language plpgsql security definer;

-- טריגר ליצירת פרופיל משתמש אוטומטית
create or replace function handle_new_user()
returns trigger as $$
begin
  -- אם המשתמש נרשם עם metadata של חברה
  if new.raw_user_meta_data->>'company_name' is not null then
    perform create_user_with_company(
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', ''),
      new.raw_user_meta_data->>'company_name'
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- יצירת הטריגר
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
