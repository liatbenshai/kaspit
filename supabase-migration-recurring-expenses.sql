-- Migration: הוצאות חוזרות (Recurring Expenses)
-- Run this in Supabase SQL Editor

-- טבלת הוצאות חוזרות
CREATE TABLE IF NOT EXISTS recurring_expenses (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  -- פרטי ההוצאה
  name text NOT NULL,                          -- שם ההוצאה (למשל: "הלוואה לדירה")
  amount decimal(15,2) NOT NULL,               -- סכום
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  description text,
  
  -- תזמון
  frequency text NOT NULL DEFAULT 'monthly'    -- monthly, weekly, yearly
    CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  day_of_month integer CHECK (day_of_month >= 1 AND day_of_month <= 31),  -- יום בחודש (1-31)
  day_of_week integer CHECK (day_of_week >= 0 AND day_of_week <= 6),      -- יום בשבוע (0=ראשון)
  month_of_year integer CHECK (month_of_year >= 1 AND month_of_year <= 12), -- חודש בשנה
  
  -- תקופה
  start_date date NOT NULL,                    -- תאריך התחלה
  end_date date,                               -- תאריך סיום (null = ללא הגבלה)
  
  -- מעקב
  last_generated_date date,                    -- תאריך ההוצאה האחרונה שנוצרה
  is_active boolean DEFAULT true,
  
  -- סוג התשלום
  expense_type text DEFAULT 'other'
    CHECK (expense_type IN (
      'loan',              -- הלוואה עסקית (קרן + ריבית)
      'social_security',   -- ביטוח לאומי
      'tax',               -- מקדמות מס הכנסה
      'vat',               -- מע״מ
      'salary',            -- משכורות
      'accountant',        -- רואה חשבון
      'rent',              -- שכירות
      'insurance',         -- ביטוחים
      'subscription',      -- מנויים ותוכנות
      'telecom',           -- תקשורת
      'utilities',         -- חשבונות (חשמל, מים)
      'bank_fees',         -- עמלות בנק
      'owner_loan_repay',  -- החזר הלוואת בעלים
      'other'              -- אחר
    )),
  
  -- מטא
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_company ON recurring_expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_recurring_expenses_active ON recurring_expenses(company_id, is_active) WHERE is_active = true;

-- הוספת שדה לקישור הוצאה להוצאה חוזרת
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS recurring_expense_id uuid REFERENCES recurring_expenses(id) ON DELETE SET NULL;

-- פונקציה ליצירת הוצאות אוטומטית
CREATE OR REPLACE FUNCTION generate_recurring_expenses(p_company_id uuid, p_target_date date DEFAULT CURRENT_DATE)
RETURNS integer AS $$
DECLARE
  rec RECORD;
  v_count integer := 0;
  v_next_date date;
  v_should_generate boolean;
BEGIN
  FOR rec IN 
    SELECT * FROM recurring_expenses 
    WHERE company_id = p_company_id 
    AND is_active = true
    AND start_date <= p_target_date
    AND (end_date IS NULL OR end_date >= p_target_date)
  LOOP
    v_should_generate := false;
    
    -- חישוב האם צריך ליצור הוצאה
    IF rec.frequency = 'monthly' THEN
      -- בדיקה אם היום בחודש תואם
      IF EXTRACT(DAY FROM p_target_date) = rec.day_of_month OR 
         (rec.day_of_month > EXTRACT(DAY FROM (date_trunc('month', p_target_date) + interval '1 month' - interval '1 day')::date) 
          AND EXTRACT(DAY FROM p_target_date) = EXTRACT(DAY FROM (date_trunc('month', p_target_date) + interval '1 month' - interval '1 day')::date))
      THEN
        -- בדיקה שלא נוצרה כבר החודש
        IF rec.last_generated_date IS NULL OR 
           date_trunc('month', rec.last_generated_date) < date_trunc('month', p_target_date)
        THEN
          v_should_generate := true;
        END IF;
      END IF;
    END IF;
    
    IF v_should_generate THEN
      -- יצירת ההוצאה
      INSERT INTO expenses (
        company_id, category_id, supplier_id, amount, date, 
        description, payment_status, recurring_expense_id
      ) VALUES (
        rec.company_id, rec.category_id, rec.supplier_id, rec.amount, p_target_date,
        rec.name || ' - ' || to_char(p_target_date, 'MM/YYYY'),
        'pending', rec.id
      );
      
      -- עדכון תאריך יצירה אחרון
      UPDATE recurring_expenses 
      SET last_generated_date = p_target_date, updated_at = NOW()
      WHERE id = rec.id;
      
      v_count := v_count + 1;
    END IF;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- הערות
COMMENT ON TABLE recurring_expenses IS 'הוצאות חוזרות - הלוואות, מסים, מנויים וכו';
COMMENT ON FUNCTION generate_recurring_expenses IS 'יצירת הוצאות אוטומטית מהגדרות חוזרות';
