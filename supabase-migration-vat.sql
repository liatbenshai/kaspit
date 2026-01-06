-- ============================================
-- כספית - Migration: הוספת שדות מע"מ
-- הרץ את הקובץ הזה על מסדי נתונים קיימים
-- ============================================

-- הוספת שדות לטבלת companies
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS vat_rate numeric(5,2) DEFAULT 18.00,
ADD COLUMN IF NOT EXISTS vat_reporting_period text DEFAULT 'monthly' 
  CHECK (vat_reporting_period IN ('monthly', 'bimonthly'));

-- הוספת שדות מע"מ לטבלת income
ALTER TABLE income 
ADD COLUMN IF NOT EXISTS amount_before_vat decimal(15,2),
ADD COLUMN IF NOT EXISTS vat_amount decimal(15,2),
ADD COLUMN IF NOT EXISTS vat_exempt boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'tax_invoice' 
  CHECK (document_type IN ('invoice', 'tax_invoice', 'tax_invoice_receipt', 'receipt', 'credit_note')),
ADD COLUMN IF NOT EXISTS document_status text DEFAULT 'open' 
  CHECK (document_status IN ('open', 'closed', 'cancelled')),
ADD COLUMN IF NOT EXISTS linked_document_id uuid REFERENCES income(id) ON DELETE SET NULL;

-- הוספת שדות מע"מ לטבלת expenses
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS amount_before_vat decimal(15,2),
ADD COLUMN IF NOT EXISTS vat_amount decimal(15,2),
ADD COLUMN IF NOT EXISTS vat_exempt boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS vat_deductible boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS document_type text DEFAULT 'tax_invoice' 
  CHECK (document_type IN ('tax_invoice', 'tax_invoice_receipt', 'receipt', 'credit_note'));

-- עדכון רשומות קיימות - חישוב מע"מ לפי הסכום הקיים
-- (מניח שהסכום הקיים כולל מע"מ)

-- עדכון הכנסות
UPDATE income 
SET 
  amount_before_vat = ROUND(amount / 1.18, 2),
  vat_amount = ROUND(amount - (amount / 1.18), 2)
WHERE amount_before_vat IS NULL 
  AND document_type IN ('tax_invoice', 'tax_invoice_receipt', 'credit_note')
  AND vat_exempt = false;

-- עדכון הוצאות  
UPDATE expenses 
SET 
  amount_before_vat = ROUND(amount / 1.18, 2),
  vat_amount = ROUND(amount - (amount / 1.18), 2)
WHERE amount_before_vat IS NULL 
  AND document_type IN ('tax_invoice', 'tax_invoice_receipt', 'credit_note')
  AND vat_exempt = false;

-- אינדקסים לשיפור ביצועים
CREATE INDEX IF NOT EXISTS idx_income_document_type ON income(document_type);
CREATE INDEX IF NOT EXISTS idx_income_vat_exempt ON income(vat_exempt);
CREATE INDEX IF NOT EXISTS idx_expenses_document_type ON expenses(document_type);
CREATE INDEX IF NOT EXISTS idx_expenses_vat_deductible ON expenses(vat_deductible);

-- הודעת סיום
DO $$ 
BEGIN 
  RAISE NOTICE 'Migration completed successfully! VAT fields added to income and expenses tables.';
END $$;
