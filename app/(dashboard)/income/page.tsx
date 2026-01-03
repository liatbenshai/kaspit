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
import { Plus, Upload, Search, Filter, Pencil, Trash2 } from 'lucide-react'
import type { Income, Category, Customer } from '@/types'

export default function IncomePage() {
  const [income, setIncome] = useState<Income[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    category_id: '',
    customer_id: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
    invoice_number: '',
    payment_status: 'pending' as 'pending' | 'partial' | 'paid',
    payment_date: '',
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

      // Load income
      const { data: incomeData } = await supabase
        .from('income')
        .select('*, category:categories(*), customer:customers(*)')
        .eq('company_id', profile.company_id)
        .order('date', { ascending: false })

      setIncome(incomeData || [])

      // Load categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('type', 'income')
        .eq('is_active', true)

      setCategories(categoriesData || [])

      // Load customers
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)

      setCustomers(customersData || [])

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
      const incomeData = {
        company_id: companyId,
        category_id: formData.category_id || null,
        customer_id: formData.customer_id || null,
        amount: parseFloat(formData.amount),
        date: formData.date,
        description: formData.description || null,
        invoice_number: formData.invoice_number || null,
        payment_status: formData.payment_status,
        payment_date: formData.payment_date || null,
      }

      if (editingIncome) {
        await supabase
          .from('income')
          .update(incomeData)
          .eq('id', editingIncome.id)
      } else {
        await supabase.from('income').insert(incomeData)
      }

      setShowAddModal(false)
      setEditingIncome(null)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving income:', error)
    }
  }

  const handleEdit = (item: Income) => {
    setEditingIncome(item)
    setFormData({
      category_id: item.category_id || '',
      customer_id: item.customer_id || '',
      amount: String(item.amount),
      date: item.date,
      description: item.description || '',
      invoice_number: item.invoice_number || '',
      payment_status: item.payment_status,
      payment_date: item.payment_date || '',
    })
    setShowAddModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק הכנסה זו?')) return

    await supabase.from('income').delete().eq('id', id)
    loadData()
  }

  const handleImport = async (data: Record<string, any>[]) => {
    if (!companyId) return

    const incomeRecords = data.map(row => ({
      company_id: companyId,
      amount: parseFloat(row.amount) || 0,
      date: row.date || new Date().toISOString().split('T')[0],
      description: row.description || null,
      invoice_number: row.invoice_number || null,
      payment_status: row.payment_status || 'pending',
    }))

    const { error } = await supabase.from('income').insert(incomeRecords)
    if (error) throw error

    loadData()
  }

  const resetForm = () => {
    setFormData({
      category_id: '',
      customer_id: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      description: '',
      invoice_number: '',
      payment_status: 'pending',
      payment_date: '',
    })
  }

  const filteredIncome = income.filter(item => {
    const matchesSearch = !searchTerm || 
      item.description?.includes(searchTerm) ||
      item.invoice_number?.includes(searchTerm) ||
      item.customer?.name?.includes(searchTerm)
    
    const matchesStatus = !filterStatus || item.payment_status === filterStatus

    return matchesSearch && matchesStatus
  })

  const totalAmount = filteredIncome.reduce((sum, item) => sum + Number(item.amount), 0)

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
        title="הכנסות"
        description="ניהול ומעקב הכנסות"
        actions={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload className="w-4 h-4" />
              ייבוא מאקסל
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              הוספת הכנסה
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
                placeholder="חיפוש לפי תיאור, מספר חשבונית או לקוח..."
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
      <div className="bg-success-50 border border-success-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <span className="text-success-800 font-medium">
            סה״כ: {filteredIncome.length} הכנסות
          </span>
          <span className="text-success-800 font-bold text-lg">
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
              <TableHead>לקוח</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIncome.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  אין הכנסות להצגה
                </TableCell>
              </TableRow>
            ) : (
              filteredIncome.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDateShort(item.date)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.description || '-'}</p>
                      {item.invoice_number && (
                        <p className="text-xs text-gray-500">חשבונית: {item.invoice_number}</p>
                      )}
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
                  <TableCell>{item.customer?.name || '-'}</TableCell>
                  <TableCell className="font-semibold text-success-600">
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
          setEditingIncome(null)
          resetForm()
        }}
        title={editingIncome ? 'עריכת הכנסה' : 'הוספת הכנסה'}
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
            placeholder="תיאור ההכנסה"
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
              label="לקוח"
              options={[
                { value: '', label: 'בחר לקוח' },
                ...customers.map(c => ({ value: c.id, label: c.name }))
              ]}
              value={formData.customer_id}
              onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
            />
          </div>

          <Input
            label="מספר חשבונית"
            value={formData.invoice_number}
            onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
          />

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
                value={formData.payment_date}
                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              />
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit">
              {editingIncome ? 'עדכון' : 'הוספה'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddModal(false)
                setEditingIncome(null)
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
          type="income"
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
