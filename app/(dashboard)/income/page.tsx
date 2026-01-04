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
import { Plus, Upload, Search, Pencil, Trash2, FileText } from 'lucide-react'
import type { Income, Category, Customer, IncomeDocumentType } from '@/types'

const VAT_RATE = 0.18 // 18% מע"מ

// סוגי מסמכים להכנסות
const incomeDocumentTypes = [
  { value: 'invoice', label: 'חשבונית עסקה' },
  { value: 'tax_invoice', label: 'חשבונית מס' },
  { value: 'tax_invoice_receipt', label: 'חשבונית מס קבלה' },
  { value: 'receipt', label: 'קבלה' },
  { value: 'credit_note', label: 'הודעת זיכוי' },
]

const getDocumentTypeLabel = (type: string) => {
  return incomeDocumentTypes.find(d => d.value === type)?.label || type
}

// האם סוג המסמך מחייב מע"מ
const isVatDocument = (type: string) => {
  return ['tax_invoice', 'tax_invoice_receipt', 'credit_note'].includes(type)
}

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
  const [filterDocType, setFilterDocType] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    category_id: '',
    customer_id: '',
    amount_before_vat: '',
    vat_amount: '',
    amount: '',
    vat_exempt: false,
    document_type: 'tax_invoice' as IncomeDocumentType,
    date: new Date().toISOString().split('T')[0],
    description: '',
    invoice_number: '',
    payment_status: 'pending' as 'pending' | 'partial' | 'paid',
    payment_date: '',
  })

  // Input mode: 'before_vat' or 'total'
  const [inputMode, setInputMode] = useState<'before_vat' | 'total'>('before_vat')

  useEffect(() => {
    loadData()
  }, [])

  // חישוב מע"מ אוטומטי
  useEffect(() => {
    // אם פטור ממע"מ או סוג מסמך שלא מחייב מע"מ
    if (formData.vat_exempt || !isVatDocument(formData.document_type)) {
      setFormData(prev => ({
        ...prev,
        vat_amount: '0',
        amount: prev.amount_before_vat
      }))
      return
    }

    if (inputMode === 'before_vat' && formData.amount_before_vat) {
      const beforeVat = parseFloat(formData.amount_before_vat) || 0
      const vat = Math.round(beforeVat * VAT_RATE * 100) / 100
      const total = Math.round((beforeVat + vat) * 100) / 100
      setFormData(prev => ({
        ...prev,
        vat_amount: String(vat),
        amount: String(total)
      }))
    } else if (inputMode === 'total' && formData.amount) {
      const total = parseFloat(formData.amount) || 0
      const beforeVat = Math.round((total / (1 + VAT_RATE)) * 100) / 100
      const vat = Math.round((total - beforeVat) * 100) / 100
      setFormData(prev => ({
        ...prev,
        amount_before_vat: String(beforeVat),
        vat_amount: String(vat)
      }))
    }
  }, [formData.amount_before_vat, formData.amount, formData.vat_exempt, formData.document_type, inputMode])

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

      const { data: incomeData } = await supabase
        .from('income')
        .select('*, category:categories(*), customer:customers(*)')
        .eq('company_id', profile.company_id)
        .order('date', { ascending: false })

      setIncome(incomeData || [])

      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('type', 'income')
        .eq('is_active', true)

      setCategories(categoriesData || [])

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
        amount_before_vat: parseFloat(formData.amount_before_vat) || null,
        vat_amount: parseFloat(formData.vat_amount) || null,
        vat_exempt: formData.vat_exempt,
        document_type: formData.document_type,
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
      amount_before_vat: String(item.amount_before_vat || ''),
      vat_amount: String(item.vat_amount || ''),
      amount: String(item.amount),
      vat_exempt: item.vat_exempt || false,
      document_type: item.document_type || 'tax_invoice',
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

    const incomeRecords = data.map(row => {
      const amount = parseFloat(row.amount) || 0
      const vatExempt = row.vat_exempt === 'true' || row.vat_exempt === true
      const docType = row.document_type || 'tax_invoice'
      const hasVat = !vatExempt && isVatDocument(docType)
      const amountBeforeVat = hasVat ? Math.round((amount / (1 + VAT_RATE)) * 100) / 100 : amount
      const vatAmount = hasVat ? Math.round((amount - amountBeforeVat) * 100) / 100 : 0

      return {
        company_id: companyId,
        amount: amount,
        amount_before_vat: amountBeforeVat,
        vat_amount: vatAmount,
        vat_exempt: vatExempt,
        document_type: docType,
        date: row.date || new Date().toISOString().split('T')[0],
        description: row.description || null,
        invoice_number: row.invoice_number || null,
        payment_status: row.payment_status || 'pending',
      }
    })

    const { error } = await supabase.from('income').insert(incomeRecords)
    if (error) throw error
    loadData()
  }

  const resetForm = () => {
    setFormData({
      category_id: '',
      customer_id: '',
      amount_before_vat: '',
      vat_amount: '',
      amount: '',
      vat_exempt: false,
      document_type: 'tax_invoice',
      date: new Date().toISOString().split('T')[0],
      description: '',
      invoice_number: '',
      payment_status: 'pending',
      payment_date: '',
    })
    setInputMode('before_vat')
  }

  const filteredIncome = income.filter(item => {
    const matchesSearch = !searchTerm || 
      item.description?.includes(searchTerm) ||
      item.invoice_number?.includes(searchTerm) ||
      item.customer?.name?.includes(searchTerm)
    
    const matchesStatus = !filterStatus || item.payment_status === filterStatus
    const matchesDocType = !filterDocType || item.document_type === filterDocType
    return matchesSearch && matchesStatus && matchesDocType
  })

  const totalAmount = filteredIncome.reduce((sum, item) => sum + Number(item.amount), 0)
  const totalVat = filteredIncome.reduce((sum, item) => sum + Number(item.vat_amount || 0), 0)
  const totalBeforeVat = filteredIncome.reduce((sum, item) => sum + Number(item.amount_before_vat || item.amount), 0)

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
              { value: '', label: 'כל סוגי המסמכים' },
              ...incomeDocumentTypes
            ]}
            value={filterDocType}
            onChange={(e) => setFilterDocType(e.target.value)}
          />
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

      {/* Summary with VAT */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-sm text-gray-500">לפני מע״מ</p>
          <p className="text-xl font-bold text-gray-900">{formatCurrency(totalBeforeVat)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-600">מע״מ (18%)</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(totalVat)}</p>
        </div>
        <div className="bg-success-50 border border-success-200 rounded-lg p-4">
          <p className="text-sm text-success-600">סה״כ כולל מע״מ</p>
          <p className="text-xl font-bold text-success-700">{formatCurrency(totalAmount)}</p>
          <p className="text-xs text-success-600">{filteredIncome.length} הכנסות</p>
        </div>
      </div>

      {/* Table */}
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>תאריך</TableHead>
              <TableHead>סוג מסמך</TableHead>
              <TableHead>תיאור</TableHead>
              <TableHead>קטגוריה</TableHead>
              <TableHead>לקוח</TableHead>
              <TableHead>לפני מע״מ</TableHead>
              <TableHead>מע״מ</TableHead>
              <TableHead>סה״כ</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIncome.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                  אין הכנסות להצגה
                </TableCell>
              </TableRow>
            ) : (
              filteredIncome.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDateShort(item.date)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{getDocumentTypeLabel(item.document_type)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.description || '-'}</p>
                      {item.invoice_number && (
                        <p className="text-xs text-gray-500">מס׳: {item.invoice_number}</p>
                      )}
                      {item.vat_exempt && (
                        <Badge variant="default" size="sm">פטור ממע״מ</Badge>
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
                    ) : '-'}
                  </TableCell>
                  <TableCell>{item.customer?.name || '-'}</TableCell>
                  <TableCell>{formatCurrency(item.amount_before_vat || item.amount)}</TableCell>
                  <TableCell className="text-blue-600">
                    {item.vat_amount ? formatCurrency(item.vat_amount) : '-'}
                  </TableCell>
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
          {/* Document Type */}
          <Select
            label="סוג מסמך"
            options={incomeDocumentTypes}
            value={formData.document_type}
            onChange={(e) => setFormData({ ...formData, document_type: e.target.value as IncomeDocumentType })}
            required
          />

          {/* VAT Input Mode Toggle - Only for VAT documents */}
          {isVatDocument(formData.document_type) && (
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">הזנת סכום:</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setInputMode('before_vat')}
                  className={`px-3 py-1 rounded text-sm ${
                    inputMode === 'before_vat'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white border text-gray-700'
                  }`}
                >
                  לפני מע״מ
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('total')}
                  className={`px-3 py-1 rounded text-sm ${
                    inputMode === 'total'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white border text-gray-700'
                  }`}
                >
                  כולל מע״מ
                </button>
              </div>
            </div>
          )}

          {/* VAT Exempt Toggle - Only for VAT documents */}
          {isVatDocument(formData.document_type) && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.vat_exempt}
                onChange={(e) => setFormData({ ...formData, vat_exempt: e.target.checked })}
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm font-medium">פטור ממע״מ</span>
            </label>
          )}

          {/* Amount Fields */}
          {isVatDocument(formData.document_type) && !formData.vat_exempt ? (
            <div className="grid grid-cols-3 gap-4">
              <Input
                label={inputMode === 'before_vat' ? 'סכום לפני מע״מ *' : 'סכום לפני מע״מ'}
                type="number"
                step="0.01"
                value={formData.amount_before_vat}
                onChange={(e) => {
                  setInputMode('before_vat')
                  setFormData({ ...formData, amount_before_vat: e.target.value })
                }}
                required={inputMode === 'before_vat'}
              />
              <Input
                label="מע״מ (18%)"
                type="number"
                step="0.01"
                value={formData.vat_amount}
                disabled
                className="bg-gray-50"
              />
              <Input
                label={inputMode === 'total' ? 'סכום כולל מע״מ *' : 'סכום כולל מע״מ'}
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => {
                  setInputMode('total')
                  setFormData({ ...formData, amount: e.target.value })
                }}
                required={inputMode === 'total'}
              />
            </div>
          ) : (
            <Input
              label="סכום"
              type="number"
              step="0.01"
              value={formData.amount_before_vat}
              onChange={(e) => setFormData({ ...formData, amount_before_vat: e.target.value, amount: e.target.value })}
              required
            />
          )}

          <Input
            label="תאריך"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
          />

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
            label="מספר מסמך"
            value={formData.invoice_number}
            onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
            placeholder="מספר חשבונית / קבלה"
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
            { key: 'amount', label: 'סכום (כולל מע״מ)', required: true },
            { key: 'date', label: 'תאריך', required: true },
            { key: 'document_type', label: 'סוג מסמך', required: false },
            { key: 'description', label: 'תיאור', required: false },
            { key: 'invoice_number', label: 'מספר מסמך', required: false },
            { key: 'vat_exempt', label: 'פטור ממע״מ (true/false)', required: false },
            { key: 'payment_status', label: 'סטטוס', required: false },
          ]}
          onImport={handleImport}
          onClose={() => setShowImportModal(false)}
        />
      </Modal>
    </div>
  )
}
