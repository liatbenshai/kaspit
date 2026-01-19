-- Migration: מעקב גבייה ותזכורות
-- Run this in Supabase SQL Editor

-- הוספת שדות מעקב גבייה לטבלת income
ALTER TABLE income 
ADD COLUMN IF NOT EXISTS collection_status text DEFAULT 'none'
  CHECK (collection_status IN (
    'none',              -- לא נשלחה תזכורת
    'reminder_sent',     -- נשלחה תזכורת
    'promised',          -- הבטיח לשלם
    'partial_received',  -- התקבל תשלום חלקי
    'dispute',           -- במחלוקת
    'legal'              -- בטיפול משפטי
  ));

ALTER TABLE income 
ADD COLUMN IF NOT EXISTS last_reminder_date date;

ALTER TABLE income 
ADD COLUMN IF NOT EXISTS reminder_count integer DEFAULT 0;

ALTER TABLE income 
ADD COLUMN IF NOT EXISTS collection_notes text;

ALTER TABLE income 
ADD COLUMN IF NOT EXISTS promised_date date;  -- תאריך שהבטיח לשלם

-- טבלת היסטוריית תזכורות
CREATE TABLE IF NOT EXISTS collection_reminders (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  income_id uuid REFERENCES income(id) ON DELETE CASCADE NOT NULL,
  
  -- פרטי התזכורת
  reminder_type text NOT NULL CHECK (reminder_type IN ('email', 'whatsapp', 'phone', 'sms')),
  sent_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  sent_to text,  -- מייל או טלפון
  
  -- תוכן
  subject text,
  message text,
  
  -- תגובה
  response text,  -- תגובת הלקוח
  response_date timestamp with time zone,
  
  created_by uuid REFERENCES users(id) ON DELETE SET NULL
);

-- טבלת תבניות תזכורת
CREATE TABLE IF NOT EXISTS reminder_templates (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  
  name text NOT NULL,
  reminder_type text NOT NULL CHECK (reminder_type IN ('email', 'whatsapp', 'phone')),
  subject text,  -- לאימייל
  message text NOT NULL,
  
  -- תבנית ברירת מחדל
  is_default boolean DEFAULT false,
  
  -- סדר (תזכורת ראשונה, שנייה, שלישית)
  sequence_order integer DEFAULT 1,
  
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- אינדקסים
CREATE INDEX IF NOT EXISTS idx_income_collection_status ON income(company_id, collection_status) 
  WHERE collection_status != 'none';
CREATE INDEX IF NOT EXISTS idx_collection_reminders_income ON collection_reminders(income_id);

-- הוספת תבניות ברירת מחדל (יתווספו כשמשתמש נרשם)
-- ניתן להריץ ידנית עם company_id ספציפי:

/*
INSERT INTO reminder_templates (company_id, name, reminder_type, subject, message, is_default, sequence_order) VALUES
('{COMPANY_ID}', 'תזכורת ראשונה - מייל', 'email', 
  'תזכורת: חשבונית מס׳ {invoice_number} לתשלום',
  'שלום {customer_name},

ברצוננו להזכירך כי חשבונית מס׳ {invoice_number} על סך {amount} ש״ח טרם שולמה.
תאריך לתשלום: {due_date}

נודה לטיפולך בהקדם.

בברכה,
{company_name}',
  true, 1),

('{COMPANY_ID}', 'תזכורת ראשונה - וואטסאפ', 'whatsapp',
  NULL,
  'שלום {customer_name}, תזכורת לתשלום חשבונית {invoice_number} על סך {amount} ש״ח. מועד לתשלום: {due_date}. תודה!',
  true, 1),

('{COMPANY_ID}', 'תזכורת שנייה - מייל', 'email',
  'תזכורת שנייה: חשבונית מס׳ {invoice_number} באיחור',
  'שלום {customer_name},

זוהי תזכורת שנייה בנוגע לחשבונית מס׳ {invoice_number} על סך {amount} ש״ח.
החשבונית באיחור של {days_overdue} ימים.

נא לפעול לסגירת החוב בהקדם האפשרי.

בברכה,
{company_name}',
  false, 2);
*/

COMMENT ON TABLE collection_reminders IS 'היסטוריית תזכורות גבייה שנשלחו';
COMMENT ON TABLE reminder_templates IS 'תבניות תזכורת לשימוש חוזר';
