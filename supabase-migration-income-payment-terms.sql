-- מיגרציה: הוספת שדות תנאי תשלום ותאריך לתשלום להכנסות
-- תאריך: 2025-01-17

-- הוספת עמודת תנאי תשלום
ALTER TABLE income 
ADD COLUMN IF NOT EXISTS payment_terms text 
CHECK (payment_terms IN ('immediate', 'eom', 'eom_plus_30', 'eom_plus_45', 'eom_plus_60', 'eom_plus_90', 'net_30', 'net_45', 'net_60', 'custom'));

-- הוספת עמודת תאריך לתשלום
ALTER TABLE income 
ADD COLUMN IF NOT EXISTS due_date date;

-- יצירת אינדקס על תאריך לתשלום לשיפור ביצועים
CREATE INDEX IF NOT EXISTS idx_income_due_date ON income(due_date);

-- יצירת אינדקס על סטטוס מסמך וסטטוס תשלום
CREATE INDEX IF NOT EXISTS idx_income_document_status ON income(document_status);
CREATE INDEX IF NOT EXISTS idx_income_payment_status ON income(payment_status);

-- פונקציה לחישוב תאריך לתשלום אוטומטי
CREATE OR REPLACE FUNCTION calculate_due_date(
  invoice_date date,
  terms text
) RETURNS date AS $$
DECLARE
  end_of_month date;
BEGIN
  -- חישוב סוף החודש של תאריך החשבונית
  end_of_month := (date_trunc('month', invoice_date) + interval '1 month' - interval '1 day')::date;
  
  CASE terms
    WHEN 'immediate' THEN
      RETURN invoice_date;
    WHEN 'eom' THEN
      RETURN end_of_month;
    WHEN 'eom_plus_30' THEN
      RETURN end_of_month + interval '30 days';
    WHEN 'eom_plus_45' THEN
      RETURN end_of_month + interval '45 days';
    WHEN 'eom_plus_60' THEN
      RETURN end_of_month + interval '60 days';
    WHEN 'eom_plus_90' THEN
      RETURN end_of_month + interval '90 days';
    WHEN 'net_30' THEN
      RETURN invoice_date + interval '30 days';
    WHEN 'net_45' THEN
      RETURN invoice_date + interval '45 days';
    WHEN 'net_60' THEN
      RETURN invoice_date + interval '60 days';
    ELSE
      RETURN NULL; -- custom או לא מוגדר
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- הערה: ניתן להריץ את הפונקציה הבאה כדי לעדכן תאריכי תשלום לחשבוניות קיימות
-- UPDATE income 
-- SET due_date = calculate_due_date(date::date, payment_terms)
-- WHERE payment_terms IS NOT NULL AND due_date IS NULL;
