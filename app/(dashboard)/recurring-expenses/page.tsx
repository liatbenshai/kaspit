'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { 
  Plus, Pencil, Trash2, Play, Pause, Calendar, 
  Home, FileText, Landmark, CreditCard, Building, Shield,
  Repeat, RefreshCw, Check, DollarSign, TrendingDown, AlertCircle, User
} from 'lucide-react'
import type { Category, Supplier } from '@/types'

interface RecurringExpense {
  id: string
  company_id: string
  name: string
  amount: number
  category_id: string | null
  supplier_id: string | null
  description: string | null
  frequency: 'weekly' | 'monthly' | 'yearly'
  day_of_month: number | null
  day_of_week: number | null
  month_of_year: number | null
  start_date: string
  end_date: string | null
  last_generated_date: string | null
  is_active: boolean
  expense_type: string
  category?: Category
  supplier?: Supplier
}

const expenseTypes = [
  { value: 'loan', label: 'הלוואה עסקית', icon: Home },
  { value: 'social_security', label: 'ביטוח לאומי', icon: Landmark },
  { value: 'tax', label: 'מקדמות מס הכנסה', icon: FileText },
  { value: 'vat', label: 'מע״מ', icon: FileText },
  { value: 'salary', label: 'משכורות', icon: CreditCard },
  { value: 'accountant', label: 'רואה חשבון', icon: FileText },
  { value: 'rent', label: 'שכירות', icon: Building },
  { value: 'insurance', label: 'ביטוחים', icon: Shield },
  { value: 'subscription', label: 'מנויים ותוכנות', icon: Repeat },
  { value: 'telecom', label: 'תקשורת', icon: Building },
  { value: 'utilities', label: 'חשבונות (חשמל/מים)', icon: Building },
  { value: 'bank_fees', label: 'עמלות בנק', icon: Landmark },
  { value: 'owner_loan_repay', label: 'החזר הלוואת בעלים', icon: User },
  { value: 'other', label: 'אחר', icon: DollarSign },
]

const frequencies = [
  { value: 'monthly', label: 'חודשי' },
  { value: 'weekly', label: 'שבועי' },
  { value: 'yearly', label: 'שנתי' },
]

const daysOfWeek = [
  { value: 0, label: 'ראשון' },
  { value: 1, label: 'שני' },
  { value: 2, label: 'שלישי' },
  { value: 3, label: 'רביעי' },
  { value: 4, label: 'חמישי' },
  { value: 5, label: 'שישי' },
  { value: 6, label: 'שבת' },
]

const months = [
  { value: 1, label: 'ינואר' }, { value: 2, label: 'פברואר' }, { value: 3, label: 'מרץ' },
  { value: 4, label: 'אפריל' }, { value: 5, label: 'מאי' }, { value: 6, label: 'יוני' },
  { value: 7, label: 'יולי' }, { value: 8, label: 'אוגוסט' }, { value: 9, label: 'ספטמבר' },
  { value: 10, label: 'אוקטובר' }, { value: 11, label: 'נובמבר' }, { value: 12, label: 'דצמבר' },
]

export default function RecurringExpensesPage() {
  const [items, setItems] = useState<RecurringExpense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<RecurringExpense | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category_id: '',
    supplier_id: '',
    description: '',
    frequency: 'monthly',
    day_of_month: '1',
    day_of_week: '0',
    month_of_year: '1',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    expense_type: 'regular',
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const { data: itemsData } = await supabase
        .from('recurring_expenses')
        .select('*, category:categories(*), supplier:suppliers(*)')
        .eq('company_id', profile.company_id)
        .order('name')

      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('type', 'expense')
        .eq('is_active', true)

      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)

      setItems(itemsData || [])
      setCategories(categoriesData || [])
      setSuppliers(suppliersData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyId) return

    try {
      const data = {
        company_id: companyId,
        name: formData.name,
        amount: parseFloat(formData.amount),
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        description: formData.description || null,
        frequency: formData.frequency,
        day_of_month: formData.frequency === 'monthly' ? parseInt(formData.day_of_month) : null,
        day_of_week: formData.frequency === 'weekly' ? parseInt(formData.day_of_week) : null,
        month_of_year: formData.frequency === 'yearly' ? parseInt(formData.month_of_year) : null,
        start_date: formData.start_date,
        end_date: formData.end_date || null,
        expense_type: formData.expense_type,
        is_active: true,
      }

      if (editingItem) {
        await supabase.from('recurring_expenses').update(data).eq('id', editingItem.id)
        setSuccessMessage('ההוצאה החוזרת עודכנה בהצלחה!')
      } else {
        await supabase.from('recurring_expenses').insert(data)
        setSuccessMessage('ההוצאה החוזרת נוספה בהצלחה!')
      }

      setShowModal(false)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving:', error)
      setError('שגיאה בשמירה')
    }
  }

  const handleEdit = (item: RecurringExpense) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      amount: String(item.amount),
      category_id: item.category_id || '',
      supplier_id: item.supplier_id || '',
      description: item.description || '',
      frequency: item.frequency,
      day_of_month: String(item.day_of_month || 1),
      day_of_week: String(item.day_of_week || 0),
      month_of_year: String(item.month_of_year || 1),
      start_date: item.start_date,
      end_date: item.end_date || '',
      expense_type: item.expense_type,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('למחוק הוצאה חוזרת זו?')) return
    await supabase.from('recurring_expenses').delete().eq('id', id)
    setSuccessMessage('ההוצאה נמחקה')
    loadData()
  }

  const toggleActive = async (item: RecurringExpense) => {
    await supabase.from('recurring_expenses').update({ is_active: !item.is_active }).eq('id', item.id)
    loadData()
  }

  const generateExpenses = async () => {
    if (!companyId) return
    setGenerating(true)
    setError(null)

    try {
      const today = new Date()
      let generatedCount = 0

      // עוברים על כל ההוצאות החוזרות הפעילות
      for (const item of items.filter(i => i.is_active)) {
        const startDate = new Date(item.start_date)
        const endDate = item.end_date ? new Date(item.end_date) : null

        if (startDate > today) continue
        if (endDate && endDate < today) continue

        let shouldGenerate = false
        let expenseDate = new Date(today)

        if (item.frequency === 'monthly' && item.day_of_month) {
          // בדיקה אם היום בחודש תואם
          const targetDay = Math.min(item.day_of_month, new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate())
          expenseDate = new Date(today.getFullYear(), today.getMonth(), targetDay)
          
          // בדיקה שלא נוצרה כבר החודש
          if (!item.last_generated_date || 
              new Date(item.last_generated_date).getMonth() !== today.getMonth() ||
              new Date(item.last_generated_date).getFullYear() !== today.getFullYear()) {
            shouldGenerate = true
          }
        }

        if (shouldGenerate) {
          // יצירת הוצאה
          const { error } = await supabase.from('expenses').insert({
            company_id: companyId,
            category_id: item.category_id,
            supplier_id: item.supplier_id,
            amount: item.amount,
            date: expenseDate.toISOString().split('T')[0],
            description: `${item.name} - ${today.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}`,
            payment_status: 'pending',
            recurring_expense_id: item.id,
          })

          if (!error) {
            // עדכון תאריך יצירה אחרון
            await supabase.from('recurring_expenses').update({
              last_generated_date: expenseDate.toISOString().split('T')[0]
            }).eq('id', item.id)
            
            generatedCount++
          }
        }
      }

      if (generatedCount > 0) {
        setSuccessMessage(`נוצרו ${generatedCount} הוצאות חדשות לחודש זה!`)
      } else {
        setSuccessMessage('כל ההוצאות לחודש זה כבר נוצרו')
      }
      loadData()
    } catch (error) {
      console.error('Error generating:', error)
      setError('שגיאה ביצירת הוצאות')
    } finally {
      setGenerating(false)
    }
  }

  const resetForm = () => {
    setEditingItem(null)
    setFormData({
      name: '',
      amount: '',
      category_id: '',
      supplier_id: '',
      description: '',
      frequency: 'monthly',
      day_of_month: '1',
      day_of_week: '0',
      month_of_year: '1',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      expense_type: 'regular',
    })
  }

  const getExpenseTypeInfo = (type: string) => expenseTypes.find(t => t.value === type) || expenseTypes[0]

  // סטטיסטיקות
  const activeItems = items.filter(i => i.is_active)
  const totalMonthly = activeItems
    .filter(i => i.frequency === 'monthly')
    .reduce((sum, i) => sum + i.amount, 0)
  const totalYearly = activeItems
    .filter(i => i.frequency === 'yearly')
    .reduce((sum, i) => sum + i.amount / 12, 0)
  const totalWeekly = activeItems
    .filter(i => i.frequency === 'weekly')
    .reduce((sum, i) => sum + i.amount * 4.33, 0)
  const totalEstimatedMonthly = totalMonthly + totalYearly + totalWeekly

  const pendingThisMonth = activeItems.filter(i => {
    if (!i.last_generated_date) return true
    const lastGen = new Date(i.last_generated_date)
    const now = new Date()
    return lastGen.getMonth() !== now.getMonth() || lastGen.getFullYear() !== now.getFullYear()
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="הוצאות חוזרות"
        description="ניהול הלוואות, מסים, מנויים והוצאות קבועות"
        actions={
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              onClick={generateExpenses} 
              disabled={generating || pendingThisMonth.length === 0}
            >
              <RefreshCw className={cn("w-4 h-4", generating && "animate-spin")} />
              צור הוצאות לחודש ({pendingThisMonth.length})
            </Button>
            <Button onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4" />
              הוספת הוצאה חוזרת
            </Button>
          </div>
        }
      />

      {successMessage && <Alert variant="success" onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>}
      {error && <Alert variant="danger" onClose={() => setError(null)}>{error}</Alert>}

      {/* סיכום */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="md" className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500 rounded-lg">
              <TrendingDown className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-red-600">הוצאות קבועות/חודש</p>
              <p className="text-xl font-bold text-red-800">{formatCurrency(totalEstimatedMonthly)}</p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Repeat className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">הוצאות פעילות</p>
              <p className="text-xl font-bold">{activeItems.length}</p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Home className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">הלוואות</p>
              <p className="text-xl font-bold">
                {formatCurrency(activeItems.filter(i => i.expense_type === 'loan').reduce((s, i) => s + i.amount, 0))}
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md" className={cn(
          pendingThisMonth.length > 0 && "bg-amber-50 border-amber-200"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", pendingThisMonth.length > 0 ? "bg-amber-500" : "bg-gray-100")}>
              <AlertCircle className={cn("w-5 h-5", pendingThisMonth.length > 0 ? "text-white" : "text-gray-600")} />
            </div>
            <div>
              <p className="text-sm text-gray-600">ממתינות ליצירה</p>
              <p className="text-xl font-bold">{pendingThisMonth.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* טבלה */}
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>תדירות</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>נוצר לאחרונה</TableHead>
              <TableHead>פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <Repeat className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">אין הוצאות חוזרות</p>
                  <p className="text-sm text-gray-400">הוסיפי הלוואות, מסים, מנויים והוצאות קבועות</p>
                </TableCell>
              </TableRow>
            ) : (
              items.map(item => {
                const typeInfo = getExpenseTypeInfo(item.expense_type)
                const TypeIcon = typeInfo.icon
                const isPending = !item.last_generated_date || 
                  new Date(item.last_generated_date).getMonth() !== new Date().getMonth()

                return (
                  <TableRow key={item.id} className={cn(!item.is_active && "opacity-50")}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{item.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">{typeInfo.label}</Badge>
                    </TableCell>
                    <TableCell className="font-bold text-danger-600">
                      {formatCurrency(item.amount)}
                    </TableCell>
                    <TableCell>
                      {item.frequency === 'monthly' && `ב-${item.day_of_month} לחודש`}
                      {item.frequency === 'weekly' && `כל יום ${daysOfWeek.find(d => d.value === item.day_of_week)?.label}`}
                      {item.frequency === 'yearly' && `פעם בשנה (${months.find(m => m.value === item.month_of_year)?.label})`}
                    </TableCell>
                    <TableCell>{item.category?.name || '-'}</TableCell>
                    <TableCell>
                      {item.is_active ? (
                        isPending ? (
                          <Badge variant="warning">ממתין ליצירה</Badge>
                        ) : (
                          <Badge variant="success">פעיל</Badge>
                        )
                      ) : (
                        <Badge variant="default">מושהה</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {item.last_generated_date ? (
                        new Date(item.last_generated_date).toLocaleDateString('he-IL')
                      ) : (
                        <span className="text-gray-400">טרם נוצר</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => toggleActive(item)}>
                          {item.is_active ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(item)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
                          <Trash2 className="w-4 h-4 text-danger-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* מודל הוספה/עריכה */}
      <Modal
        isOpen={showModal}
        onClose={() => { setShowModal(false); resetForm() }}
        title={editingItem ? 'עריכת הוצאה חוזרת' : 'הוספת הוצאה חוזרת'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="שם ההוצאה"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="למשל: הלוואה לדירה, ביטוח לאומי..."
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="סכום"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              required
            />
            <Select
              label="סוג הוצאה"
              options={expenseTypes.map(t => ({ value: t.value, label: t.label }))}
              value={formData.expense_type}
              onChange={(e) => setFormData(prev => ({ ...prev, expense_type: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="קטגוריה"
              options={[{ value: '', label: 'בחר קטגוריה' }, ...categories.map(c => ({ value: c.id, label: c.name }))]}
              value={formData.category_id}
              onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
            />
            <Select
              label="ספק (אופציונלי)"
              options={[{ value: '', label: 'בחר ספק' }, ...suppliers.map(s => ({ value: s.id, label: s.name }))]}
              value={formData.supplier_id}
              onChange={(e) => setFormData(prev => ({ ...prev, supplier_id: e.target.value }))}
            />
          </div>

          <Select
            label="תדירות"
            options={frequencies}
            value={formData.frequency}
            onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
          />

          {formData.frequency === 'monthly' && (
            <Select
              label="יום בחודש"
              options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))}
              value={formData.day_of_month}
              onChange={(e) => setFormData(prev => ({ ...prev, day_of_month: e.target.value }))}
            />
          )}

          {formData.frequency === 'weekly' && (
            <Select
              label="יום בשבוע"
              options={daysOfWeek.map(d => ({ value: String(d.value), label: d.label }))}
              value={formData.day_of_week}
              onChange={(e) => setFormData(prev => ({ ...prev, day_of_week: e.target.value }))}
            />
          )}

          {formData.frequency === 'yearly' && (
            <Select
              label="חודש בשנה"
              options={months.map(m => ({ value: String(m.value), label: m.label }))}
              value={formData.month_of_year}
              onChange={(e) => setFormData(prev => ({ ...prev, month_of_year: e.target.value }))}
            />
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="תאריך התחלה"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
              required
            />
            <Input
              label="תאריך סיום (אופציונלי)"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
            />
          </div>

          <Input
            label="הערות"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="פרטים נוספים..."
          />

          <div className="flex gap-3 pt-4 border-t">
            <Button type="submit">
              <Check className="w-4 h-4" />
              {editingItem ? 'עדכן' : 'הוסף'}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setShowModal(false); resetForm() }}>
              ביטול
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
