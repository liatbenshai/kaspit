-- ============================================
-- Migration: הוספת עמודת אמצעי תשלום לטבלת הוצאות
-- ============================================

-- הוספת עמודת payment_method לטבלת expenses
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS payment_method text 
CHECK (payment_method IN ('bank_transfer', 'standing_order', 'credit_card', 'cash', 'check'));

-- הערה: להרצה ב-Supabase SQL Editor
-- הערכים האפשריים:
--   bank_transfer = העברה בנקאית
--   standing_order = הוראת קבע
--   credit_card = כרטיס אשראי
--   cash = מזומן
--   check = צ'ק
