-- ============================================
-- KASPIT - Migration מאוחד לכל השדרוגים
-- הרץ את הקובץ הזה פעם אחת ב-Supabase SQL Editor
-- ============================================

-- =====================
-- 1. שדרוג טבלת income
-- =====================
ALTER TABLE income 
ADD COLUMN IF NOT EXISTS due_date date;

ALTER TABLE income 
ADD COLUMN IF NOT EXISTS bank_transaction_id uuid REFERENCES bank_transactions(id) ON DELETE SET NULL;

ALTER TABLE income 
ADD COLUMN IF NOT EXISTS collection_status text DEFAULT 'none'
  CHECK (collection_status IN ('none', 'reminder_sent', 'promised', 'partial_received', 'dispute', 'legal'));

ALTER TABLE income 
ADD COLUMN IF NOT EXISTS last_reminder_date date;

ALTER TABLE income 
ADD COLUMN IF NOT EXISTS reminder_count integer DEFAULT 0;

ALTER TABLE income 
ADD COLUMN IF NOT EXISTS collection_notes text;

ALTER TABLE income 
ADD COLUMN IF NOT EXISTS promised_date date;

-- =====================
-- 2. שדרוג טבלת expenses
-- =====================
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS recurring_expense_id uuid;

ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS bank_transaction_id uuid REFERENCES bank_transactions(id) ON DELETE SET NULL;

-- =====================
-- 3. שדרוג טבלת bank_transactions
-- =====================
ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS transaction_type text DEFAULT 'regular'
  CHECK (transaction_type IN (
    'regular', 'loan', 'owner_withdrawal', 'owner_deposit', 
    'bank_fees', 'tax', 'vat', 'social_security', 
    'salary', 'transfer_between', 'other'
  ));

ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;

ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS recurring_label text;

ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE SET NULL;

ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS notes text;

-- =====================
-- 4. טבלת הוצאות חוזרות
-- =====================
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  name text NOT NULL,
  amount decimal(15,2) NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  description text,
  
  frequency text NOT NULL DEFAULT 'monthly'
    CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  day_of_month integer CHECK (day_of_month >= 1 AND day_of_month <= 31),
  day_of_week integer CHECK (day_of_week >= 0 AND day_of_week <= 6),
  month_of_year integer CHECK (month_of_year >= 1 AND month_of_year <= 12),
  
  start_date date NOT NULL,
  end_date date,
  last_generated_date date,
  is_active boolean DEFAULT true,
  
  expense_type text DEFAULT 'other'
    CHECK (expense_type IN (
      'loan', 'social_security', 'tax', 'vat', 'salary', 
      'accountant', 'rent', 'insurance', 'subscription', 
      'telecom', 'utilities', 'bank_fees', 'owner_loan_repay', 'other'
    )),
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- אינדקס להוצאות חוזרות
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_company ON recurring_expenses(company_id);

-- קישור expenses להוצאה חוזרת
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'expenses_recurring_expense_id_fkey'
  ) THEN
    ALTER TABLE expenses 
    ADD CONSTRAINT expenses_recurring_expense_id_fkey 
    FOREIGN KEY (recurring_expense_id) REFERENCES recurring_expenses(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================
-- 5. טבלת תזכורות גבייה
-- =====================
CREATE TABLE IF NOT EXISTS collection_reminders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  income_id uuid REFERENCES income(id) ON DELETE CASCADE NOT NULL,
  
  reminder_type text NOT NULL CHECK (reminder_type IN ('email', 'whatsapp', 'phone', 'sms')),
  sent_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  sent_to text,
  
  subject text,
  message text,
  
  response text,
  response_date timestamp with time zone,
  
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_collection_reminders_income ON collection_reminders(income_id);

-- =====================
-- 6. טבלת כללי התאמה
-- =====================
CREATE TABLE IF NOT EXISTS matching_rules (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  pattern text NOT NULL,
  pattern_type text DEFAULT 'contains' CHECK (pattern_type IN ('contains', 'starts_with', 'exact', 'regex')),
  
  target_type text NOT NULL CHECK (target_type IN ('income', 'expense', 'transfer', 'ignore')),
  
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  
  transaction_type text,
  is_recurring boolean DEFAULT false,
  recurring_label text,
  
  times_used integer DEFAULT 0,
  last_used_at timestamp with time zone,
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_active boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_matching_rules_company ON matching_rules(company_id, is_active);

-- =====================
-- 7. כללי התאמה נפוצים (אופציונלי)
-- =====================
-- הוסיפי כללים בסיסיים לחברה שלך:
-- לדוגמה (החליפי את {COMPANY_ID} ב-ID של החברה):
/*
INSERT INTO matching_rules (company_id, pattern, pattern_type, target_type, transaction_type, is_recurring, recurring_label) VALUES
('{COMPANY_ID}', 'מס הכנסה', 'contains', 'expense', 'tax', true, 'מקדמות מס'),
('{COMPANY_ID}', 'ביטוח לאומי', 'contains', 'expense', 'social_security', true, 'ביטוח לאומי'),
('{COMPANY_ID}', 'מע"מ', 'contains', 'expense', 'vat', true, 'מע"מ'),
('{COMPANY_ID}', 'עמלת', 'starts_with', 'expense', 'bank_fees', false, null),
('{COMPANY_ID}', 'דמי ניהול', 'contains', 'expense', 'bank_fees', true, 'דמי ניהול'),
('{COMPANY_ID}', 'ישראכרט', 'contains', 'transfer', null, true, 'סליקת אשראי'),
('{COMPANY_ID}', 'כאל', 'contains', 'transfer', null, true, 'סליקת אשראי'),
('{COMPANY_ID}', 'הלוואה', 'contains', 'expense', 'loan', true, 'החזר הלוואה');
*/

-- הערות
COMMENT ON TABLE recurring_expenses IS 'הוצאות חוזרות - הלוואות, מסים, מנויים';
COMMENT ON TABLE collection_reminders IS 'היסטוריית תזכורות גבייה';
COMMENT ON TABLE matching_rules IS 'כללי התאמה אוטומטית לתנועות בנק';

-- =====================
-- סיום!
-- =====================
SELECT 'Migration completed successfully!' as status;
