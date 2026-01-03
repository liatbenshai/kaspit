// ============================================
// סוגי נתונים - כספית
// ============================================

// משתמש
export interface User {
  id: string
  email: string
  full_name: string | null
  role: 'admin' | 'finance_manager'
  company_id: string
  avatar_url: string | null
  last_login: string | null
  created_at: string
}

// חברה
export interface Company {
  id: string
  name: string
  logo_url: string | null
  address: string | null
  phone: string | null
  email: string | null
  tax_id: string | null
  created_at: string
}

// קטגוריה
export interface Category {
  id: string
  company_id: string
  name: string
  type: 'income' | 'expense'
  color: string
  icon: string
  parent_id: string | null
  is_active: boolean
  created_at: string
}

// ספק
export interface Supplier {
  id: string
  company_id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  tax_id: string | null
  payment_terms: number
  notes: string | null
  is_active: boolean
  created_at: string
}

// לקוח
export interface Customer {
  id: string
  company_id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  tax_id: string | null
  payment_terms: number
  notes: string | null
  is_active: boolean
  created_at: string
}

// הכנסה
export interface Income {
  id: string
  company_id: string
  category_id: string | null
  customer_id: string | null
  amount: number
  date: string
  description: string | null
  invoice_number: string | null
  payment_status: 'pending' | 'partial' | 'paid'
  payment_date: string | null
  created_by: string | null
  created_at: string
  // Relations
  category?: Category
  customer?: Customer
}

// הוצאה
export interface Expense {
  id: string
  company_id: string
  category_id: string | null
  supplier_id: string | null
  amount: number
  date: string
  description: string | null
  invoice_number: string | null
  payment_status: 'pending' | 'partial' | 'paid'
  due_date: string | null
  paid_date: string | null
  is_recurring: boolean
  recurring_day: number | null
  created_by: string | null
  created_at: string
  // Relations
  category?: Category
  supplier?: Supplier
}

// תנועת בנק
export interface BankTransaction {
  id: string
  company_id: string
  bank_name: string | null
  account_number: string | null
  date: string
  amount: number
  description: string | null
  balance: number | null
  matched_type: 'income' | 'expense' | null
  matched_id: string | null
  import_batch_id: string | null
  created_at: string
}

// חשבונית
export interface Invoice {
  id: string
  company_id: string
  type: 'income' | 'expense'
  number: string | null
  date: string
  due_date: string | null
  amount: number
  vat_amount: number
  total_amount: number
  supplier_id: string | null
  customer_id: string | null
  status: 'pending' | 'partial' | 'paid' | 'cancelled'
  file_url: string | null
  notes: string | null
  created_at: string
  // Relations
  supplier?: Supplier
  customer?: Customer
}

// תקציב
export interface Budget {
  id: string
  company_id: string
  category_id: string
  year: number
  month: number
  amount: number
  created_by: string | null
  created_at: string
  // Relations
  category?: Category
}

// התראה
export interface Alert {
  id: string
  company_id: string
  user_id: string | null
  type: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'critical' | 'success'
  is_read: boolean
  related_type: string | null
  related_id: string | null
  created_at: string
}

// לוג ייבוא
export interface ImportLog {
  id: string
  company_id: string
  user_id: string | null
  type: 'bank' | 'invoice' | 'income' | 'expense'
  file_name: string | null
  records_count: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  errors: Record<string, any> | null
  created_at: string
}

// הגדרות
export interface Setting {
  id: string
  company_id: string
  key: string
  value: any
}

// ============================================
// סוגים לטפסים
// ============================================

export interface IncomeFormData {
  category_id: string
  customer_id?: string
  amount: number
  date: string
  description?: string
  invoice_number?: string
  payment_status: 'pending' | 'partial' | 'paid'
  payment_date?: string
}

export interface ExpenseFormData {
  category_id: string
  supplier_id?: string
  amount: number
  date: string
  description?: string
  invoice_number?: string
  payment_status: 'pending' | 'partial' | 'paid'
  due_date?: string
  paid_date?: string
  is_recurring?: boolean
  recurring_day?: number
}

export interface CategoryFormData {
  name: string
  type: 'income' | 'expense'
  color?: string
  icon?: string
  parent_id?: string
}

export interface BudgetFormData {
  category_id: string
  year: number
  month: number
  amount: number
}

// ============================================
// סוגים לדוחות וסטטיסטיקות
// ============================================

export interface MonthlySummary {
  total_income: number
  total_expenses: number
  net_profit: number
  income_count: number
  expense_count: number
}

export interface CategorySummary {
  category_id: string
  category_name: string
  category_color: string
  total: number
  count: number
  percentage: number
}

export interface TrendData {
  month: string
  income: number
  expenses: number
  profit: number
}

export interface BudgetVsActual {
  category_id: string
  category_name: string
  budgeted: number
  actual: number
  percentage: number
  difference: number
}

// ============================================
// סוגים לייבוא Excel
// ============================================

export interface ExcelColumn {
  key: string
  label: string
  required: boolean
}

export interface ImportMapping {
  [excelColumn: string]: string // maps excel column to database field
}

export interface ImportResult {
  success: boolean
  recordsImported: number
  errors: string[]
}
