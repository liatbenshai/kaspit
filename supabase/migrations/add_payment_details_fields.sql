-- הוספת שדות תשלום מורחבים לטבלת הכנסות
-- actual_payer_name = שם מי ששילם בפועל (כשמישהו אחר משלם במקום הלקוח בחשבונית)
-- receipt_number = מספר חשבונית מס קבלה
-- project_number = מספר פרויקט/עבודה

ALTER TABLE income 
ADD COLUMN IF NOT EXISTS actual_payer_name TEXT,
ADD COLUMN IF NOT EXISTS receipt_number TEXT,
ADD COLUMN IF NOT EXISTS project_number TEXT;

-- הוספת אינדקס למספר פרויקט לחיפוש מהיר
CREATE INDEX IF NOT EXISTS idx_income_project_number ON income(project_number);

-- הערה על העמודות
COMMENT ON COLUMN income.actual_payer_name IS 'שם מי ששילם בפועל (אם שונה מהלקוח בחשבונית)';
COMMENT ON COLUMN income.receipt_number IS 'מספר חשבונית מס קבלה';
COMMENT ON COLUMN income.project_number IS 'מספר פרויקט/עבודה';
