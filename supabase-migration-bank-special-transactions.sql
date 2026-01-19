-- Migration: הוספת תמיכה בתנועות בנק מיוחדות
-- Run this in Supabase SQL Editor

-- הוספת שדה סוג תנועה
ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS transaction_type text 
DEFAULT 'regular'
CHECK (transaction_type IN (
  'regular',           -- תנועה רגילה
  'loan_payment',      -- תשלום הלוואה
  'owner_withdrawal',  -- משיכת בעלים
  'owner_deposit',     -- הפקדת בעלים
  'bank_fee',          -- עמלת בנק
  'tax_payment',       -- תשלום מס
  'vat_payment',       -- תשלום מע״מ
  'social_security',   -- ביטוח לאומי
  'salary',            -- משכורות
  'transfer_between',  -- העברה בין חשבונות
  'other'              -- אחר
));

-- הוספת שדה תנועה חוזרת
ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS is_recurring boolean DEFAULT false;

-- הוספת שדה תיאור לתנועה חוזרת (למשל "הלוואה לדירה")
ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS recurring_label text;

-- הוספת שדה קטגוריה לתנועות שלא מקושרות להכנסה/הוצאה
ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES categories(id) ON DELETE SET NULL;

-- הוספת הערות
ALTER TABLE bank_transactions 
ADD COLUMN IF NOT EXISTS notes text;

-- יצירת אינדקס לסוג תנועה
CREATE INDEX IF NOT EXISTS idx_bank_transactions_type ON bank_transactions(company_id, transaction_type);

-- יצירת אינדקס לתנועות חוזרות
CREATE INDEX IF NOT EXISTS idx_bank_transactions_recurring ON bank_transactions(company_id, is_recurring) WHERE is_recurring = true;

COMMENT ON COLUMN bank_transactions.transaction_type IS 'סוג התנועה: regular=רגילה, loan_payment=הלוואה, owner_withdrawal=משיכת בעלים, etc.';
COMMENT ON COLUMN bank_transactions.is_recurring IS 'האם זו תנועה חוזרת (הלוואה, הוראת קבע וכו)';
COMMENT ON COLUMN bank_transactions.recurring_label IS 'תווית לתנועה חוזרת, למשל: הלוואה לדירה';
