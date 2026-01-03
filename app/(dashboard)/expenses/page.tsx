'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { ExcelImport } from '@/components/import/ExcelImport'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDateShort, translateStatus, getStatusColor } from '@/lib/utils'
import { Plus, Upload, Search, Pencil, Trash2, RotateCcw } from 'lucide-react'
import type { Expense, Category, Supplier } from '@/types'

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    category_id: '',
    supplier_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    invoice_number: '',
    payment_status: 'pending' as 'pending' | 'partial' | 'paid',
    due_date: '',
    paid_date: '',
    is_recurring: false,
    recurring_day: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const { data: expensesData } = await supabase
        .from('expenses')
        .select('*, category:categories(*), supplier:suppliers(*)')
        .eq('company_id', profile.company_id)
        .order('date', { ascending: false })

      setExpenses(expensesData || [])

      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('type', 'expense')
        .eq('is_active', true)

      setCategories(categoriesData || [])

      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)

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
      const expenseData = {
        company_id: companyId,
        category_id: formData.category_id || null,
        supplier_id: formData.supplier_id || null,
        amount: parseFloat(formData.amount),
        date: formData.date,
        description: formData.description || null,
        invoice_number: formData.invoice_number || null,
        payment_status: formData.payment_status,
        due_date: formData.due_date || null,
        paid_date: formData.paid_date || null,
        is_recurring: formData.is_recurring,
        recurring_day: formData.recurring_day ? parseInt(formData.recurring_day) : null,
      }

      if (editingExpense) {
        await supabase
          .from('expenses')
          .update(expenseData)
          .eq('id', editingExpense.id)
      } else {
        await supabase.from('expenses').insert(expenseData)
      }

      setShowAddModal(false)
      setEditingExpense(null)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving expense:', error)
    }
  }

  const handleEdit = (item: Expense) => {
    setEditingExpense(item)
    setFormData({
      category_id: item.category_id || '',
      supplier_id: item.supplier_id || '',
      amount: String(item.amount),
      date: item.date,
      description: item.description || '',
      invoice_number: item.invoice_number || '',
      payment_status: item.payment_status,
      due_date: item.due_date || '',
      paid_date: item.paid_date || '',
      is_recurring: item.is_recurring,
      recurring_day: item.recurring_day ? String(item.recurring_day) : '',
    })
    setShowAddModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק הוצאה זו?')) return
    await supabase.from('expenses').delete().eq('id', id)
    loadData()
  }

  const handleImport = async (data: Record<string, any>[]) => {
    if (!companyId) return

    const expenseRecords = data.map(row => ({
      company_id: companyId,
      amount: parseFloat(row.amount) || 0,
      date: row.date || new Date().toISOString().split('T')[0],
      description: row.description || null,
      invoice_number: row.invoice_number || null,
      payment_status: row.payment_status || 'pending',
    }))

    const { error } = await supabase.from('expenses').insert(expenseRecords)
    if (error) throw error
    loadData()
  }

  const resetForm = () => {
    setFormData({
      category_id: '',
      supplier_id: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      invoice_number: '',
      payment_status: 'pending',
      due_date: '',
      paid_date: '',
      is_recurring: false,
      recurring_day: '',
    })
  }

  const filteredExpenses = expenses.filter(item => {
    const matchesSearch = !searchTerm || 
      item.description?.includes(searchTerm) ||
      item.invoice_number?.includes(searchTerm) ||
      item.supplier?.name?.includes(searchTerm)
    
    const matchesStatus = !filterStatus || item.payment_status === filterStatus
    return matchesSearch && matchesStatus
  })

  const totalAmount = filteredExpenses.reduce((sum, item) => sum + Number(item.amount), 0)

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
        title="הוצאות"
        description="ניהול ומעקב הוצאות"
        actions={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload className="w-4 h-4" />
              ייבוא מאקסל
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              הוספת הוצאה
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="חיפוש לפי תיאור, מספר חשבונית או ספק..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>
          </div>
          <Select
            options={[
              { value: '', label: 'כל הסטטוסים' },
              { value: 'pending', label: 'ממתין' },
              { value: 'partial', label: 'שולם חלקית' },
              { value: 'paid', label: 'שולם' },
            ]}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          />
        </div>
      </Card>

      {/* Summary */}
      <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-danger-800 font-medium">
            סה״כ: {filteredExpenses.length} הוצאות
          </span>
          <span className="text-danger-800 font-bold text-lg">
            {formatCurrency(totalAmount)}
          </span>
        </div>
      </div>

      {/* Table */}
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>תאריך</TableHead>
              <TableHead>תיאור</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>ספק</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  אין הוצאות להצגה
                </TableCell>
              </TableRow>
            ) : (
              filteredExpenses.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDateShort(item.date)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {item.is_recurring && (
                        <span title="הוצאה חוזרת"><RotateCcw className="w-4 h-4 text-primary-500" /></span>
                      )}
                      <div>
                        <p className="font-medium">{item.description || '-'}</p>
                        {item.invoice_number && (
                          <p className="text-xs text-gray-500">חשבונית: {item.invoice_number}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {item.category ? (
                      <span
                        className="inline-flex items-center gap-1 text-sm"
                        style={{ color: item.category.color }}
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: item.category.color }}
                        />
                        {item.category.name}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>{item.supplier?.name || '-'}</TableCell>
                  <TableCell className="font-semibold text-danger-600">
                    {formatCurrency(item.amount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusColor(item.payment_status) as any}>
                      {translateStatus(item.payment_status)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1 text-gray-400 hover:text-primary-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 text-gray-400 hover:text-danger-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setEditingExpense(null)
          resetForm()
        }}
        title={editingExpense ? 'עריכת הוצאה' : 'הוספת הוצאה'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="סכום"
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
            <Input
              label="תאריך"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <Input
            label="תיאור"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="תיאור ההוצאה"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="קטגוריה"
              options={[
                { value: '', label: 'בחר קטגוריה' },
                ...categories.map(c => ({ value: c.id, label: c.name }))
              ]}
              value={formData.category_id}
              onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
            />
            <Select
              label="ספק"
              options={[
                { value: '', label: 'בחר ספק' },
                ...suppliers.map(s => ({ value: s.id, label: s.name }))
              ]}
              value={formData.supplier_id}
              onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="מספר חשבונית"
              value={formData.invoice_number}
              onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
            />
            <Input
              label="תאריך יעד לתשלום"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="סטטוס תשלום"
              options={[
                { value: 'pending', label: 'ממתין' },
                { value: 'partial', label: 'שולם חלקית' },
                { value: 'paid', label: 'שולם' },
              ]}
              value={formData.payment_status}
              onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as any })}
            />
            {formData.payment_status === 'paid' && (
              <Input
                label="תאריך תשלום"
                type="date"
                value={formData.paid_date}
                onChange={(e) => setFormData({ ...formData, paid_date: e.target.value })}
              />
            )}
          </div>

          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.is_recurring}
                onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm font-medium">הוצאה חוזרת (חודשית)</span>
            </label>
            {formData.is_recurring && (
              <Input
                type="number"
                min="1"
                max="31"
                value={formData.recurring_day}
                onChange={(e) => setFormData({ ...formData, recurring_day: e.target.value })}
                placeholder="יום בחודש"
                className="w-32"
              />
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit">
              {editingExpense ? 'עדכון' : 'הוספה'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddModal(false)
                setEditingExpense(null)
                resetForm()
              }}
            >
              ביטול
            </Button>
          </div>
        </form>
      </Modal>

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        size="xl"
      >
        <ExcelImport
          type="expense"
          requiredFields={[
            { key: 'amount', label: 'סכום', required: true },
            { key: 'date', label: 'תאריך', required: true },
            { key: 'description', label: 'תיאור', required: false },
            { key: 'invoice_number', label: 'מספר חשבונית', required: false },
            { key: 'payment_status', label: 'סטטוס', required: false },
          ]}
          onImport={handleImport}
          onClose={() => setShowImportModal(false)}
        />
      </Modal>
    </div>
  )
}
