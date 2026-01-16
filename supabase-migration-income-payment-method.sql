-- ============================================
-- Migration: הוספת עמודת אמצעי תשלום לטבלאות
-- ============================================

-- הוספת עמודת payment_method לטבלת income (הכנסות)
ALTER TABLE income 
ADD COLUMN IF NOT EXISTS payment_method text 
CHECK (payment_method IN ('bank_transfer', 'credit_card', 'cash', 'check', 'bit'));

-- עדכון הערכים האפשריים בטבלת expenses (הוצאות) - הוספת 'bit'
-- קודם צריך להסיר את האילוץ הישן ואז להוסיף חדש
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_payment_method_check;
ALTER TABLE expenses 
ADD CONSTRAINT expenses_payment_method_check 
CHECK (payment_method IN ('bank_transfer', 'standing_order', 'credit_card', 'cash', 'check', 'bit'));

-- הערה: להרצה ב-Supabase SQL Editor
-- 
-- הערכים האפשריים להכנסות:
--   bank_transfer = העברה בנקאית
--   credit_card = כרטיס אשראי
--   cash = מזומן
--   check = צ'ק
--   bit = ביט / פייבוקס
--
-- הערכים האפשריים להוצאות (כולל הוראת קבע):
--   bank_transfer = העברה בנקאית
--   standing_order = הוראת קבע
--   credit_card = כרטיס אשראי
--   cash = מזומן
--   check = צ'ק
--   bit = ביט / פייבוקס
