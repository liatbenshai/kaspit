'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { ExcelImport } from '@/components/import/ExcelImport'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDateShort, translateStatus, getStatusColor } from '@/lib/utils'
import { Plus, Upload, Search, Pencil, Trash2, FileText, Link2, Link2Off, AlertTriangle, Check, X, Square, CheckSquare, Filter, Clock, Info } from 'lucide-react'
import type { Income, Category, Customer, IncomeDocumentType, DocumentStatus } from '@/types'

const VAT_RATE = 0.18

type PaymentMethod = 'bank_transfer' | 'credit_card' | 'cash' | 'check' | 'bit' | ''

const paymentMethods = [
  { value: '', label: 'בחר אמצעי תשלום' },
  { value: 'bank_transfer', label: 'העברה בנקאית' },
  { value: 'credit_card', label: 'כרטיס אשראי' },
  { value: 'cash', label: 'מזומן' },
  { value: 'check', label: 'צ׳ק' },
  { value: 'bit', label: 'ביט / פייבוקס' },
]

const paymentTermsOptions = [
  { value: '', label: 'בחר תנאי תשלום' },
  { value: 'immediate', label: 'מיידי' },
  { value: 'eom', label: 'שוטף (סוף חודש)' },
  { value: 'eom_plus_30', label: 'שוטף + 30' },
  { value: 'eom_plus_45', label: 'שוטף + 45' },
  { value: 'eom_plus_60', label: 'שוטף + 60' },
  { value: 'eom_plus_90', label: 'שוטף + 90' },
  { value: 'net_30', label: '30 יום' },
  { value: 'net_45', label: '45 יום' },
  { value: 'net_60', label: '60 יום' },
  { value: 'custom', label: 'מותאם אישית' },
]

const calculateDueDate = (invoiceDate: string, terms: string): string | null => {
  if (!invoiceDate || !terms) return null
  const date = new Date(invoiceDate)
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  
  switch (terms) {
    case 'immediate': return invoiceDate
    case 'eom': return endOfMonth.toISOString().split('T')[0]
    case 'eom_plus_30': endOfMonth.setDate(endOfMonth.getDate() + 30); return endOfMonth.toISOString().split('T')[0]
    case 'eom_plus_45': endOfMonth.setDate(endOfMonth.getDate() + 45); return endOfMonth.toISOString().split('T')[0]
    case 'eom_plus_60': endOfMonth.setDate(endOfMonth.getDate() + 60); return endOfMonth.toISOString().split('T')[0]
    case 'eom_plus_90': endOfMonth.setDate(endOfMonth.getDate() + 90); return endOfMonth.toISOString().split('T')[0]
    case 'net_30': date.setDate(date.getDate() + 30); return date.toISOString().split('T')[0]
    case 'net_45': date.setDate(date.getDate() + 45); return date.toISOString().split('T')[0]
    case 'net_60': date.setDate(date.getDate() + 60); return date.toISOString().split('T')[0]
    default: return null
  }
}

const isOverdue = (dueDate: string | null, paymentStatus: string): boolean => {
  if (!dueDate || paymentStatus === 'paid') return false
  return new Date(dueDate) < new Date()
}

const incomeDocumentTypes = [
  { value: 'invoice', label: 'חשבונית עסקה' },
  { value: 'tax_invoice', label: 'חשבונית מס' },
  { value: 'tax_invoice_receipt', label: 'חשבונית מס קבלה' },
  { value: 'receipt', label: 'קבלה' },
  { value: 'credit_note', label: 'הודעת זיכוי' },
]

const documentStatusLabels: Record<DocumentStatus, string> = { open: 'פתוח', closed: 'סגור', cancelled: 'מבוטל' }
const documentStatusColors: Record<DocumentStatus, string> = { open: 'warning', closed: 'success', cancelled: 'default' }
const getDocumentTypeLabel = (type: string) => incomeDocumentTypes.find(d => d.value === type)?.label || type
const isVatDocument = (type: string) => ['tax_invoice', 'tax_invoice_receipt', 'credit_note'].includes(type)
const isBusinessInvoice = (type: string) => type === 'invoice'
const canCloseInvoice = (type: string) => ['tax_invoice', 'tax_invoice_receipt'].includes(type)

// ==========================================
// פונקציית סינון חכמה למציאת חשבוניות מס מתאימות
// ==========================================
const getRelevantTaxDocuments = (businessInvoice: Income, allIncome: Income[]) => {
  return allIncome.filter(doc => {
    // רק חשבוניות מס שיכולות לסגור
    if (!canCloseInvoice(doc.document_type)) return false
    // רק מסמכים ללא קישור קיים
    if (doc.linked_document_id) return false
    // מסמך סגור או מבוטל - לא רלוונטי
    if (doc.document_status === 'cancelled') return false
    
    return true
  }).map(doc => {
    // חישוב התאמה
    const sameCustomer = businessInvoice.customer_id && doc.customer_id === businessInvoice.customer_id
    const amountDiff = Math.abs(doc.amount - businessInvoice.amount)
    const amountDiffPercent = businessInvoice.amount > 0 ? (amountDiff / businessInvoice.amount) * 100 : 100
    const daysDiff = Math.abs(
      new Date(doc.date).getTime() - new Date(businessInvoice.date).getTime()
    ) / (1000 * 60 * 60 * 24)
    
    // ציון התאמה: 100 = מושלם, 0 = לא מתאים
    let matchScore = 0
    if (sameCustomer) matchScore += 50
    if (amountDiffPercent <= 1) matchScore += 40
    else if (amountDiffPercent <= 5) matchScore += 30
    else if (amountDiffPercent <= 10) matchScore += 15
    if (daysDiff <= 7) matchScore += 10
    else if (daysDiff <= 30) matchScore += 5
    
    return {
      ...doc,
      matchScore,
      sameCustomer,
      amountDiff,
      amountDiffPercent,
      daysDiff,
    }
  }).sort((a, b) => b.matchScore - a.matchScore) // מיון לפי ציון התאמה
}

// פונקציה למציאת חשבוניות עסקה פתוחות לקישור
const getRelevantBusinessInvoices = (taxDocument: Income, allIncome: Income[]) => {
  return allIncome.filter(doc => {
    // רק חשבוניות עסקה פתוחות
    if (!isBusinessInvoice(doc.document_type)) return false
    if (doc.document_status !== 'open') return false
    
    return true
  }).map(doc => {
    const sameCustomer = taxDocument.customer_id && doc.customer_id === taxDocument.customer_id
    const amountDiff = Math.abs(doc.amount - taxDocument.amount)
    const amountDiffPercent = taxDocument.amount > 0 ? (amountDiff / taxDocument.amount) * 100 : 100
    const daysDiff = Math.abs(
      new Date(doc.date).getTime() - new Date(taxDocument.date).getTime()
    ) / (1000 * 60 * 60 * 24)
    
    let matchScore = 0
    if (sameCustomer) matchScore += 50
    if (amountDiffPercent <= 1) matchScore += 40
    else if (amountDiffPercent <= 5) matchScore += 30
    else if (amountDiffPercent <= 10) matchScore += 15
    if (daysDiff <= 7) matchScore += 10
    else if (daysDiff <= 30) matchScore += 5
    
    return {
      ...doc,
      matchScore,
      sameCustomer,
      amountDiff,
      amountDiffPercent,
      daysDiff,
    }
  }).sort((a, b) => b.matchScore - a.matchScore)
}

export default function IncomePage() {
  const searchParams = useSearchParams()
  const [income, setIncome] = useState<Income[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showLinkModal, setShowLinkModal] = useState(false)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [linkingDocument, setLinkingDocument] = useState<Income | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterDocType, setFilterDocType] = useState('')
  const [filterDocStatus, setFilterDocStatus] = useState('')
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterMonth, setFilterMonth] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false)
  const [bulkUpdateData, setBulkUpdateData] = useState({ payment_method: '', category_id: '', customer_id: '', payment_status: '' })
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [inputMode, setInputMode] = useState<'before_vat' | 'total'>('before_vat')
  const [showAllLinkedDocs, setShowAllLinkedDocs] = useState(false) // הצג גם מסמכים עם התאמה נמוכה

  const [formData, setFormData] = useState({
    category_id: '', customer_id: '', amount_before_vat: '', vat_amount: '', amount: '',
    vat_exempt: false, document_type: 'tax_invoice' as IncomeDocumentType, linked_document_id: '',
    date: new Date().toISOString().split('T')[0], due_date: '', payment_terms: '',
    description: '', invoice_number: '', payment_status: 'pending' as 'pending' | 'partial' | 'paid',
    payment_date: '', payment_method: '' as PaymentMethod,
    project_number: '', receipt_number: '', actual_payer_name: '',
  })

  // פתיחת מודל הוספה מ-URL parameter
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setShowAddModal(true)
    }
  }, [searchParams])

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (formData.vat_exempt || !isVatDocument(formData.document_type)) {
      setFormData(prev => ({ ...prev, vat_amount: '0', amount: prev.amount_before_vat }))
      return
    }
    if (inputMode === 'before_vat' && formData.amount_before_vat) {
      const beforeVat = parseFloat(formData.amount_before_vat) || 0
      const vat = Math.round(beforeVat * VAT_RATE * 100) / 100
      const total = Math.round((beforeVat + vat) * 100) / 100
      setFormData(prev => ({ ...prev, vat_amount: String(vat), amount: String(total) }))
    } else if (inputMode === 'total' && formData.amount) {
      const total = parseFloat(formData.amount) || 0
      const beforeVat = Math.round((total / (1 + VAT_RATE)) * 100) / 100
      const vat = Math.round((total - beforeVat) * 100) / 100
      setFormData(prev => ({ ...prev, amount_before_vat: String(beforeVat), vat_amount: String(vat) }))
    }
  }, [formData.amount_before_vat, formData.amount, formData.vat_exempt, formData.document_type, inputMode])

  useEffect(() => {
    if (formData.payment_terms && formData.payment_terms !== 'custom' && formData.date) {
      const calculatedDueDate = calculateDueDate(formData.date, formData.payment_terms)
      if (calculatedDueDate) setFormData(prev => ({ ...prev, due_date: calculatedDueDate }))
    }
  }, [formData.payment_terms, formData.date])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const { data: incomeData } = await supabase
        .from('income')
        .select('*, category:categories(*), customer:customers(*), linked_document:income!linked_document_id(*)')
        .eq('company_id', profile.company_id)
        .order('date', { ascending: false })
      setIncome(incomeData || [])

      const { data: categoriesData } = await supabase.from('categories').select('*').eq('company_id', profile.company_id).eq('type', 'income').eq('is_active', true)
      setCategories(categoriesData || [])

      const { data: customersData } = await supabase.from('customers').select('*').eq('company_id', profile.company_id).eq('is_active', true)
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
      const documentStatus: DocumentStatus = isBusinessInvoice(formData.document_type) ? 'open' : 'closed'

      const incomeData = {
        company_id: companyId,
        category_id: formData.category_id || null,
        customer_id: formData.customer_id || null,
        amount: parseFloat(formData.amount),
        amount_before_vat: parseFloat(formData.amount_before_vat) || null,
        vat_amount: parseFloat(formData.vat_amount) || null,
        vat_exempt: formData.vat_exempt,
        document_type: formData.document_type,
        document_status: documentStatus,
        linked_document_id: formData.linked_document_id || null,
        date: formData.date,
        due_date: formData.due_date || null,
        payment_terms: formData.payment_terms || null,
        description: formData.description || null,
        invoice_number: formData.invoice_number || null,
        payment_status: formData.payment_status,
        payment_date: formData.payment_date || null,
        payment_method: formData.payment_method || null,
        project_number: formData.project_number || null,
        receipt_number: formData.receipt_number || null,
        actual_payer_name: formData.actual_payer_name || null,
      }

      if (editingIncome) {
        // אם הסרנו קישור קיים - פתח מחדש את חשבונית העסקה
        if (editingIncome.linked_document_id && !formData.linked_document_id) {
          await supabase.from('income').update({ document_status: 'open' }).eq('id', editingIncome.linked_document_id)
        }
        // אם שינינו קישור - פתח את הישן וסגור את החדש
        if (editingIncome.linked_document_id && formData.linked_document_id && editingIncome.linked_document_id !== formData.linked_document_id) {
          await supabase.from('income').update({ document_status: 'open' }).eq('id', editingIncome.linked_document_id)
          if (canCloseInvoice(formData.document_type)) {
            await supabase.from('income').update({ document_status: 'closed' }).eq('id', formData.linked_document_id)
          }
        }
        // אם הוספנו קישור חדש - סגור את חשבונית העסקה
        if (!editingIncome.linked_document_id && formData.linked_document_id && canCloseInvoice(formData.document_type)) {
          await supabase.from('income').update({ document_status: 'closed' }).eq('id', formData.linked_document_id)
        }
        
        await supabase.from('income').update(incomeData).eq('id', editingIncome.id)
        setSuccessMessage('המסמך עודכן בהצלחה')
      } else {
        const { data: newIncome } = await supabase.from('income').insert(incomeData).select().single()
        if (newIncome && formData.linked_document_id && canCloseInvoice(formData.document_type)) {
          await supabase.from('income').update({ document_status: 'closed' }).eq('id', formData.linked_document_id)
        }
        setSuccessMessage('המסמך נוסף בהצלחה')
      }

      setShowAddModal(false)
      setEditingIncome(null)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving income:', error)
      setError('שגיאה בשמירת המסמך')
    }
  }

  // ==========================================
  // קישור מסמכים - גרסה משופרת
  // ==========================================
  const handleLinkDocument = async (businessInvoiceId: string, taxDocumentId: string) => {
    try {
      // עדכון חשבונית המס עם קישור לחשבונית העסקה
      await supabase.from('income').update({ linked_document_id: businessInvoiceId }).eq('id', taxDocumentId)
      // סגירת חשבונית העסקה
      await supabase.from('income').update({ document_status: 'closed' }).eq('id', businessInvoiceId)
      
      setShowLinkModal(false)
      setLinkingDocument(null)
      setSuccessMessage('המסמכים קושרו בהצלחה!')
      loadData()
    } catch (error) {
      console.error('Error linking documents:', error)
      setError('שגיאה בקישור המסמכים')
    }
  }

  // ==========================================
  // הסרת קישור בין מסמכים - חדש!
  // ==========================================
  const handleUnlinkDocument = async (documentId: string) => {
    if (!confirm('האם להסיר את הקישור בין המסמכים? חשבונית העסקה תחזור לסטטוס פתוח.')) return
    
    try {
      const document = income.find(i => i.id === documentId)
      if (!document || !document.linked_document_id) return
      
      // הסרת הקישור מחשבונית המס
      await supabase.from('income').update({ linked_document_id: null }).eq('id', documentId)
      // פתיחה מחדש של חשבונית העסקה
      await supabase.from('income').update({ document_status: 'open' }).eq('id', document.linked_document_id)
      
      setSuccessMessage('הקישור הוסר בהצלחה')
      loadData()
    } catch (error) {
      console.error('Error unlinking documents:', error)
      setError('שגיאה בהסרת הקישור')
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
      linked_document_id: item.linked_document_id || '',
      date: item.date,
      due_date: (item as any).due_date || '',
      payment_terms: (item as any).payment_terms || '',
      description: item.description || '',
      invoice_number: item.invoice_number || '',
      payment_status: item.payment_status,
      payment_date: item.payment_date || '',
      payment_method: (item as any).payment_method || '',
      project_number: (item as any).project_number || '',
      receipt_number: (item as any).receipt_number || '',
      actual_payer_name: (item as any).actual_payer_name || '',
    })
    setShowAddModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק מסמך זה?')) return
    
    try {
      // אם יש קישור - פתח את חשבונית העסקה
      const document = income.find(i => i.id === id)
      if (document?.linked_document_id) {
        await supabase.from('income').update({ document_status: 'open' }).eq('id', document.linked_document_id)
      }
      
      await supabase.from('income').delete().eq('id', id)
      setSuccessMessage('המסמך נמחק')
      loadData()
    } catch (error) {
      console.error('Error deleting:', error)
      setError('שגיאה במחיקת המסמך')
    }
  }

  // ========================================
  // ייבוא הכנסות
  // ========================================
  const handleImport = async (data: Record<string, any>[]) => {
    if (!companyId) return

    const documentTypeMap: Record<string, string> = {
      'חשבונית מס': 'tax_invoice', 'חשבונית מס קבלה': 'tax_invoice_receipt',
      'הודעת זיכוי': 'credit_note', 'חשבונית זיכוי': 'credit_note',
      'חשבונית עסקה': 'invoice', 'חשבון עיסקה': 'invoice', 'קבלה': 'receipt',
    }

    const documentStatusMap: Record<string, { docStatus: string, payStatus: string }> = {
      'מסמך סגור': { docStatus: 'closed', payStatus: 'paid' },
      'פתוח': { docStatus: 'open', payStatus: 'pending' },
    }

    const paymentTermsMap: Record<string, string> = {
      'מיידי': 'immediate', 'שוטף': 'eom', 'שוטף + 30': 'eom_plus_30', 'שוטף +30': 'eom_plus_30',
      'שוטף + 45': 'eom_plus_45', 'שוטף +45': 'eom_plus_45', 'שוטף + 60': 'eom_plus_60',
      'שוטף +60': 'eom_plus_60', 'שוטף + 90': 'eom_plus_90', 'שוטף +90': 'eom_plus_90',
    }

    // מיפוי אמצעי תשלום
    const paymentMethodMap: Record<string, string> = {
      'העברה בנקאית': 'bank_transfer',
      'העברה': 'bank_transfer',
      'כרטיס אשראי': 'credit_card',
      'אשראי': 'credit_card',
      'מזומן': 'cash',
      'צ׳ק': 'check',
      'צק': 'check',
      'שיק': 'check',
      'ביט': 'bit',
      'ביט / פייבוקס': 'bit',
      'פייבוקס': 'bit',
    }

    const getValue = (row: Record<string, any>, ...keys: string[]): any => {
      for (const key of keys) {
        if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
          return row[key]
        }
      }
      return null
    }

    const parseDate = (dateStr: any): string => {
      if (!dateStr) return new Date().toISOString().split('T')[0]
      const str = String(dateStr).trim()
      const ddmmyyyy = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/)
      if (ddmmyyyy) {
        const [, day, month, year] = ddmmyyyy
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
      }
      if (str.match(/^\d{4}-\d{2}-\d{2}$/)) return str
      const parsed = new Date(str)
      if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0]
      return new Date().toISOString().split('T')[0]
    }

    // שלב 1: איסוף שמות לקוחות ייחודיים
    const uniqueCustomerNames = new Set<string>()
    data.forEach(row => {
      const name = getValue(row, 'שם לקוח', 'שם הלקוח', 'customer_name')?.toString().trim()
      if (name) uniqueCustomerNames.add(name)
    })

    // שלב 2: יצירת לקוחות חדשים
    const existingCustomerNames = new Set(customers.map(c => c.name))
    const newCustomerNames = Array.from(uniqueCustomerNames).filter(name => !existingCustomerNames.has(name))
    
    let updatedCustomers = [...customers]
    if (newCustomerNames.length > 0) {
      const BATCH_SIZE = 100
      for (let i = 0; i < newCustomerNames.length; i += BATCH_SIZE) {
        const batch = newCustomerNames.slice(i, i + BATCH_SIZE).map(name => ({
          company_id: companyId, name, is_active: true,
        }))
        const { data: inserted } = await supabase.from('customers').insert(batch).select()
        if (inserted) updatedCustomers = [...updatedCustomers, ...inserted]
      }
    }

    const findCustomerId = (name: string | null): string | null => {
      if (!name) return null
      const trimmed = String(name).trim()
      return updatedCustomers.find(c => c.name === trimmed)?.id || null
    }

    // שלב 3: הכנת רשומות
    const incomeRecords = data.map(row => {
      const customerName = getValue(row, 'שם לקוח', 'שם הלקוח', 'customer_name')?.toString().trim() || ''
      const amountTotal = parseFloat(getValue(row, 'סכום כולל מע״מ', 'חשבונית רגילה', 'amount')) || 0
      const amountBeforeVat = parseFloat(getValue(row, 'סכום לפני מע״מ', 'חשבונית ללא מע"מ (אילת וחו"ל)', 'amount_before_vat')) || amountTotal
      const vatAmount = parseFloat(getValue(row, 'מע״מ', 'מוכר מע"מ', 'vat_amount')) || 0
      
      const docTypeRaw = getValue(row, 'סוג מסמך', 'document_type')?.toString().trim() || ''
      const docType = documentTypeMap[docTypeRaw] || docTypeRaw || 'tax_invoice'
      
      const statusRaw = getValue(row, 'סטטוס', 'status')?.toString().trim() || ''
      const statusMapping = documentStatusMap[statusRaw] || { docStatus: 'open', payStatus: 'pending' }
      
      let documentStatus = isBusinessInvoice(docType) ? (statusMapping.docStatus === 'closed' ? 'closed' : 'open') : 'closed'
      let paymentStatus = statusMapping.payStatus
      
      if (docType === 'receipt' || docType === 'tax_invoice_receipt') paymentStatus = 'paid'

      const customerId = findCustomerId(customerName)
      
      const paymentTermsRaw = getValue(row, 'תנאי תשלום', 'payment_terms')?.toString().trim() || ''
      let paymentTerms = paymentTermsMap[paymentTermsRaw] || paymentTermsRaw || ''
      
      if ((docType === 'receipt' || docType === 'tax_invoice_receipt' || docType === 'invoice') && !paymentTerms) {
        paymentTerms = 'immediate'
      }
      
      const docDate = parseDate(getValue(row, 'תאריך', 'תאריך המסמך', 'date'))
      let dueDate = getValue(row, 'due_date') ? parseDate(getValue(row, 'due_date')) : null
      if (paymentTerms && !dueDate) dueDate = calculateDueDate(docDate, paymentTerms)

      // אמצעי תשלום
      const paymentMethodRaw = getValue(row, 'אמצעי תשלום', 'payment_method')?.toString().trim() || ''
      const paymentMethod = paymentMethodMap[paymentMethodRaw] || null

      return {
        company_id: companyId,
        category_id: null,
        customer_id: customerId,
        amount: amountTotal || amountBeforeVat,
        amount_before_vat: amountBeforeVat,
        vat_amount: vatAmount,
        vat_exempt: vatAmount === 0,
        document_type: docType,
        document_status: documentStatus,
        date: docDate,
        due_date: dueDate,
        payment_terms: paymentTerms || null,
        description: getValue(row, 'תיאור', 'description')?.toString() || null,
        invoice_number: getValue(row, 'מספר מסמך', 'מספר המסמך', 'invoice_number')?.toString() || null,
        payment_status: paymentStatus,
        payment_method: paymentMethod,
        _customer_name: customerName,
      }
    })

    // שלב 4: ייבוא ב-batches
    const INCOME_BATCH_SIZE = 100
    let allInsertedRecords: Income[] = []
    
    for (let i = 0; i < incomeRecords.length; i += INCOME_BATCH_SIZE) {
      const batch = incomeRecords.slice(i, i + INCOME_BATCH_SIZE).map(({ _customer_name, ...record }) => record)
      const { data: inserted, error } = await supabase.from('income').insert(batch).select()
      if (error) throw error
      if (inserted) allInsertedRecords = [...allInsertedRecords, ...inserted]
    }

    // שלב 5: קישור אוטומטי
    let linkedCount = 0
    if (allInsertedRecords.length > 0) {
      linkedCount = await performSafeAutoLinking(incomeRecords, allInsertedRecords)
    }

    loadData()
    
    const businessInvoiceCount = incomeRecords.filter(r => isBusinessInvoice(r.document_type)).length
    const taxDocCount = incomeRecords.filter(r => canCloseInvoice(r.document_type) || r.document_type === 'receipt').length
    
    setSuccessMessage(
      `יובאו ${allInsertedRecords.length} מסמכים בהצלחה! ` +
      (newCustomerNames.length > 0 ? `נוצרו ${newCustomerNames.length} לקוחות חדשים. ` : '') +
      `(${businessInvoiceCount} חשבונות עיסקה, ${taxDocCount} חשבוניות מס/קבלות` +
      (linkedCount > 0 ? `, ${linkedCount} קושרו אוטומטית` : '') + ')'
    )
  }

  // קישור אוטומטי חכם - רק כשיש התאמה מושלמת
  const performSafeAutoLinking = async (originalRecords: any[], insertedRecords: Income[]): Promise<number> => {
    const allBusinessInvoices: { id: string; customerName: string; amount: number; date: string }[] = []
    
    insertedRecords.forEach((record, index) => {
      if (isBusinessInvoice(record.document_type)) {
        allBusinessInvoices.push({
          id: record.id,
          customerName: originalRecords[index]?._customer_name || '',
          amount: record.amount,
          date: record.date,
        })
      }
    })
    
    income.filter(i => isBusinessInvoice(i.document_type) && i.document_status === 'open').forEach(inv => {
      allBusinessInvoices.push({
        id: inv.id,
        customerName: inv.customer?.name || '',
        amount: inv.amount,
        date: inv.date,
      })
    })

    const linksToCreate: { taxDocId: string; businessInvoiceId: string }[] = []
    const invoicesToClose: string[] = []

    for (let i = 0; i < insertedRecords.length; i++) {
      const insertedRecord = insertedRecords[i]
      const originalRecord = originalRecords[i]

      if (!canCloseInvoice(insertedRecord.document_type) && insertedRecord.document_type !== 'receipt') continue

      const customerName = originalRecord?._customer_name || ''
      const amount = insertedRecord.amount

      // חיפוש התאמה מושלמת - אותו לקוח, אותו סכום (±1 ש"ח), תאריך לפני
      const matches = allBusinessInvoices.filter(inv => 
        inv.customerName === customerName && 
        Math.abs(inv.amount - amount) < 1 &&
        new Date(inv.date) <= new Date(insertedRecord.date)
      )

      // רק אם יש התאמה יחידה וחד-משמעית
      if (matches.length === 1 && !invoicesToClose.includes(matches[0].id)) {
        linksToCreate.push({ taxDocId: insertedRecord.id, businessInvoiceId: matches[0].id })
        invoicesToClose.push(matches[0].id)
      }
    }

    // ביצוע במקביל
    const BATCH_SIZE = 50
    for (let i = 0; i < linksToCreate.length; i += BATCH_SIZE) {
      const batch = linksToCreate.slice(i, i + BATCH_SIZE)
      await Promise.all(batch.map(link => 
        supabase.from('income').update({ linked_document_id: link.businessInvoiceId }).eq('id', link.taxDocId)
      ))
    }

    if (invoicesToClose.length > 0) {
      await supabase.from('income').update({ document_status: 'closed' }).in('id', invoicesToClose)
    }

    return linksToCreate.length
  }

  const resetForm = () => {
    setFormData({
      category_id: '', customer_id: '', amount_before_vat: '', vat_amount: '', amount: '',
      vat_exempt: false, document_type: 'tax_invoice', linked_document_id: '',
      date: new Date().toISOString().split('T')[0], due_date: '', payment_terms: '',
      description: '', invoice_number: '', payment_status: 'pending', payment_date: '', payment_method: '',
      project_number: '', receipt_number: '', actual_payer_name: '',
    })
    setInputMode('before_vat')
  }

  const filteredIncome = income.filter(item => {
    const matchesSearch = !searchTerm || 
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = !filterStatus || item.payment_status === filterStatus
    const matchesDocType = !filterDocType || item.document_type === filterDocType
    const matchesDocStatus = !filterDocStatus || item.document_status === filterDocStatus
    const matchesPaymentMethod = !filterPaymentMethod || (item as any).payment_method === filterPaymentMethod
    const matchesCategory = !filterCategory || item.category_id === filterCategory
    const matchesCustomer = !filterCustomer || item.customer_id === filterCustomer
    const itemDate = new Date(item.date)
    const matchesMonth = !filterMonth || (itemDate.getMonth() + 1) === parseInt(filterMonth)
    const matchesYear = !filterYear || itemDate.getFullYear() === parseInt(filterYear)
    return matchesSearch && matchesStatus && matchesDocType && matchesDocStatus && matchesPaymentMethod && matchesCategory && matchesCustomer && matchesMonth && matchesYear
  })

  const availableYears = Array.from(new Set(income.map(i => new Date(i.date).getFullYear()))).sort((a, b) => b - a)

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) newSet.delete(id)
      else newSet.add(id)
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredIncome.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filteredIncome.map(i => i.id)))
  }

  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return
    const updateData: Record<string, any> = {}
    if (bulkUpdateData.payment_method) updateData.payment_method = bulkUpdateData.payment_method
    if (bulkUpdateData.category_id) updateData.category_id = bulkUpdateData.category_id
    if (bulkUpdateData.customer_id) updateData.customer_id = bulkUpdateData.customer_id
    if (bulkUpdateData.payment_status) updateData.payment_status = bulkUpdateData.payment_status

    if (Object.keys(updateData).length === 0) {
      setError('יש לבחור לפחות שדה אחד לעדכון')
      return
    }

    try {
      const { error } = await supabase.from('income').update(updateData).in('id', Array.from(selectedIds))
      if (error) throw error
      setSuccessMessage(`עודכנו ${selectedIds.size} הכנסות בהצלחה!`)
      setShowBulkUpdateModal(false)
      setBulkUpdateData({ payment_method: '', category_id: '', customer_id: '', payment_status: '' })
      clearSelection()
      loadData()
    } catch (err: any) {
      setError(`שגיאה בעדכון: ${err.message}`)
    }
  }

  const clearFilters = () => {
    setSearchTerm(''); setFilterStatus(''); setFilterDocType(''); setFilterDocStatus('')
    setFilterPaymentMethod(''); setFilterCategory(''); setFilterCustomer(''); setFilterMonth(''); setFilterYear('')
  }

  const hasActiveFilters = searchTerm || filterStatus || filterDocType || filterDocStatus || filterPaymentMethod || filterCategory || filterCustomer || filterMonth || filterYear

  // חשבוניות עסקה פתוחות
  const openBusinessInvoices = income.filter(i => i.document_type === 'invoice' && i.document_status === 'open')
  
  // חשבוניות מס בלי קישור - לשימוש בסלקט של הטופס
  const unlinkedTaxDocuments = income.filter(i => canCloseInvoice(i.document_type) && !i.linked_document_id)

  const totalAmount = filteredIncome.reduce((sum, item) => sum + Number(item.amount), 0)
  const totalVat = filteredIncome.filter(i => isVatDocument(i.document_type)).reduce((sum, item) => sum + Number(item.vat_amount || 0), 0)
  const pendingPayments = income.filter(i => i.payment_status !== 'paid' && i.document_status !== 'cancelled')
  const totalPending = pendingPayments.reduce((sum, item) => sum + Number(item.amount), 0)
  const overduePayments = income.filter(i => isOverdue((i as any).due_date, i.payment_status))
  const totalOverdue = overduePayments.reduce((sum, item) => sum + Number(item.amount), 0)
  const futurePayments = income.filter(i => (i as any).due_date && new Date((i as any).due_date) > new Date() && i.payment_status !== 'paid')
  const totalFuture = futurePayments.reduce((sum, item) => sum + Number(item.amount), 0)

  // מסמכים רלוונטיים לקישור - עם ציון התאמה
  const relevantDocsForLinking = linkingDocument 
    ? (isBusinessInvoice(linkingDocument.document_type) 
        ? getRelevantTaxDocuments(linkingDocument, income)
        : getRelevantBusinessInvoices(linkingDocument, income))
    : []

  // סינון לפי ציון התאמה
  const filteredDocsForLinking = showAllLinkedDocs 
    ? relevantDocsForLinking 
    : relevantDocsForLinking.filter(d => d.matchScore >= 30)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const importRequiredFields = [
    { key: 'תאריך', label: 'תאריך', required: false },
    { key: 'סוג מסמך', label: 'סוג מסמך', required: false },
    { key: 'מספר מסמך', label: 'מספר מסמך', required: false },
    { key: 'שם לקוח', label: 'שם לקוח', required: false },
    { key: 'סכום כולל מע״מ', label: 'סכום כולל מע״מ', required: false },
    { key: 'סכום לפני מע״מ', label: 'סכום לפני מע״מ', required: false },
    { key: 'מע״מ', label: 'מע״מ', required: false },
    { key: 'תנאי תשלום', label: 'תנאי תשלום', required: false },
    { key: 'אמצעי תשלום', label: 'אמצעי תשלום', required: false },
    { key: 'סטטוס', label: 'סטטוס', required: false },
    { key: 'תיאור', label: 'תיאור', required: false },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="הכנסות"
        description="ניהול ומעקב הכנסות ומסמכים"
        actions={
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              <Upload className="w-4 h-4" />
              ייבוא מאקסל
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              הוספת מסמך
            </Button>
          </div>
        }
      />

      {openBusinessInvoices.length > 0 && (
        <Alert variant="warning">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>יש {openBusinessInvoices.length} חשבוניות עסקה פתוחות שטרם הומרו לחשבונית מס</span>
          </div>
        </Alert>
      )}

      {error && <Alert variant="danger" onClose={() => setError(null)}>{error}</Alert>}
      {successMessage && <Alert variant="success" onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>}

      {selectedIds.size > 0 && (
        <Card padding="md" className="bg-primary-50 border-primary-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-primary-600" />
              <span className="font-medium text-primary-900">נבחרו {selectedIds.size} הכנסות</span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowBulkUpdateModal(true)}>עדכון שדות</Button>
              <Button size="sm" variant="outline" onClick={clearSelection}>ביטול בחירה</Button>
            </div>
          </div>
        </Card>
      )}

      <Card padding="md">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input placeholder="חיפוש לפי מספר מסמך או לקוח..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pr-10" />
              </div>
            </div>
            <Button variant={showAdvancedFilters ? 'primary' : 'outline'} size="sm" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
              <Filter className="w-4 h-4" />
              סינון {hasActiveFilters && `(${[filterStatus, filterDocType, filterDocStatus, filterPaymentMethod, filterCategory, filterCustomer, filterMonth, filterYear].filter(Boolean).length})`}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}><X className="w-4 h-4" />נקה</Button>
            )}
          </div>

          {showAdvancedFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 pt-3 border-t">
              <Select options={[{ value: '', label: 'סוג מסמך' }, ...incomeDocumentTypes]} value={filterDocType} onChange={(e) => setFilterDocType(e.target.value)} />
              <Select options={[{ value: '', label: 'סטטוס מסמך' }, { value: 'open', label: 'פתוח' }, { value: 'closed', label: 'סגור' }, { value: 'cancelled', label: 'מבוטל' }]} value={filterDocStatus} onChange={(e) => setFilterDocStatus(e.target.value)} />
              <Select options={[{ value: '', label: 'סטטוס תשלום' }, { value: 'pending', label: 'ממתין' }, { value: 'partial', label: 'שולם חלקית' }, { value: 'paid', label: 'שולם' }]} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} />
              <Select options={[{ value: '', label: 'אמצעי תשלום' }, { value: 'bank_transfer', label: 'העברה בנקאית' }, { value: 'credit_card', label: 'כרטיס אשראי' }, { value: 'cash', label: 'מזומן' }, { value: 'check', label: 'צ׳ק' }, { value: 'bit', label: 'ביט / פייבוקס' }]} value={filterPaymentMethod} onChange={(e) => setFilterPaymentMethod(e.target.value)} />
              <Select options={[{ value: '', label: 'קטגוריה' }, ...categories.map(c => ({ value: c.id, label: c.name }))]} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} />
              <Select options={[{ value: '', label: 'לקוח' }, ...customers.map(c => ({ value: c.id, label: c.name }))]} value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} />
              <Select options={[{ value: '', label: 'חודש' }, { value: '1', label: 'ינואר' }, { value: '2', label: 'פברואר' }, { value: '3', label: 'מרץ' }, { value: '4', label: 'אפריל' }, { value: '5', label: 'מאי' }, { value: '6', label: 'יוני' }, { value: '7', label: 'יולי' }, { value: '8', label: 'אוגוסט' }, { value: '9', label: 'ספטמבר' }, { value: '10', label: 'אוקטובר' }, { value: '11', label: 'נובמבר' }, { value: '12', label: 'דצמבר' }]} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} />
              <Select options={[{ value: '', label: 'שנה' }, ...availableYears.map(y => ({ value: y.toString(), label: y.toString() }))]} value={filterYear} onChange={(e) => setFilterYear(e.target.value)} />
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-success-50 border border-success-200 rounded-lg p-4">
          <p className="text-sm text-success-600">סה״כ (מסוננים)</p>
          <p className="text-xl font-bold text-success-700">{formatCurrency(totalAmount)}</p>
          <p className="text-xs text-success-600">{filteredIncome.length} מסמכים</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-600">מע״מ עסקאות</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(totalVat)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-600">ממתין לתשלום</p>
          <p className="text-xl font-bold text-amber-700">{formatCurrency(totalPending)}</p>
          <p className="text-xs text-amber-600">{pendingPayments.length} מסמכים</p>
        </div>
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-4">
          <p className="text-sm text-primary-600">הכנסות עתידיות</p>
          <p className="text-xl font-bold text-primary-700">{formatCurrency(totalFuture)}</p>
          <p className="text-xs text-primary-600">{futurePayments.length} מסמכים</p>
        </div>
        {totalOverdue > 0 && (
          <div className="bg-danger-50 border border-danger-200 rounded-lg p-4">
            <p className="text-sm text-danger-600 flex items-center gap-1"><Clock className="w-4 h-4" />באיחור!</p>
            <p className="text-xl font-bold text-danger-700">{formatCurrency(totalOverdue)}</p>
            <p className="text-xs text-danger-600">{overduePayments.length} מסמכים</p>
          </div>
        )}
      </div>

      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <button onClick={toggleSelectAll} className="p-1 hover:bg-gray-100 rounded">
                  {selectedIds.size === filteredIncome.length && filteredIncome.length > 0 ? <CheckSquare className="w-5 h-5 text-primary-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                </button>
              </TableHead>
              <TableHead>תאריך</TableHead>
              <TableHead>סוג מסמך</TableHead>
              <TableHead>מס׳</TableHead>
              <TableHead>לקוח</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>לתשלום</TableHead>
              <TableHead>אמצעי תשלום</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredIncome.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-gray-500">אין מסמכים להצגה</TableCell>
              </TableRow>
            ) : (
              filteredIncome.map((item) => (
                <TableRow key={item.id} className={`${item.document_status === 'cancelled' ? 'opacity-50' : ''} ${selectedIds.has(item.id) ? 'bg-primary-50' : ''}`}>
                  <TableCell>
                    <button onClick={() => toggleSelectItem(item.id)} className="p-1 hover:bg-gray-100 rounded">
                      {selectedIds.has(item.id) ? <CheckSquare className="w-5 h-5 text-primary-600" /> : <Square className="w-5 h-5 text-gray-400" />}
                    </button>
                  </TableCell>
                  <TableCell>{formatDateShort(item.date)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{getDocumentTypeLabel(item.document_type)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{item.invoice_number || '-'}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.customer?.name || '-'}</p>
                      {/* הצגת קישור עם אפשרות להסרה */}
                      {item.linked_document_id && (
                        <div className="flex items-center gap-1 mt-1">
                          <Link2 className="w-3 h-3 text-primary-600" />
                          <span className="text-xs text-primary-600">
                            מקושר לחשבונית עסקה {(item as any).linked_document?.invoice_number && `#${(item as any).linked_document.invoice_number}`}
                          </span>
                          <button 
                            onClick={() => handleUnlinkDocument(item.id)}
                            className="p-0.5 text-gray-400 hover:text-danger-600 rounded"
                            title="הסר קישור"
                          >
                            <Link2Off className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold">{formatCurrency(item.amount)}</TableCell>
                  <TableCell>
                    {(item as any).due_date ? (
                      <div className={`flex items-center gap-1 ${isOverdue((item as any).due_date, item.payment_status) ? 'text-danger-600' : ''}`}>
                        {isOverdue((item as any).due_date, item.payment_status) && <Clock className="w-4 h-4" />}
                        <span className="text-sm">{formatDateShort((item as any).due_date)}</span>
                      </div>
                    ) : <span className="text-gray-400 text-sm">-</span>}
                  </TableCell>
                  <TableCell>
                    {(item as any).payment_method ? (
                      <Badge variant="default">{paymentMethods.find(p => p.value === (item as any).payment_method)?.label || (item as any).payment_method}</Badge>
                    ) : <span className="text-gray-400 text-sm">לא הוגדר</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={documentStatusColors[item.document_status] as any} size="sm">{documentStatusLabels[item.document_status]}</Badge>
                      <Badge variant={getStatusColor(item.payment_status) as any} size="sm">{translateStatus(item.payment_status)}</Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* כפתור קישור לחשבונית עסקה פתוחה */}
                      {isBusinessInvoice(item.document_type) && item.document_status === 'open' && (
                        <button onClick={() => { setLinkingDocument(item); setShowLinkModal(true); setShowAllLinkedDocs(false) }} className="p-1 text-primary-500 hover:text-primary-700" title="קשר לחשבונית מס">
                          <Link2 className="w-4 h-4" />
                        </button>
                      )}
                      {/* כפתור קישור לחשבונית מס ללא קישור */}
                      {canCloseInvoice(item.document_type) && !item.linked_document_id && openBusinessInvoices.length > 0 && (
                        <button onClick={() => { setLinkingDocument(item); setShowLinkModal(true); setShowAllLinkedDocs(false) }} className="p-1 text-primary-500 hover:text-primary-700" title="קשר לחשבונית עסקה">
                          <Link2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => handleEdit(item)} className="p-1 text-gray-400 hover:text-primary-600"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => handleDelete(item.id)} className="p-1 text-gray-400 hover:text-danger-600"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setEditingIncome(null); resetForm() }} title={editingIncome ? 'עריכת מסמך' : 'הוספת מסמך'} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="סוג מסמך" options={incomeDocumentTypes} value={formData.document_type} onChange={(e) => setFormData({ ...formData, document_type: e.target.value as IncomeDocumentType })} required />

          {/* קישור לחשבונית עסקה - משופר עם אפשרות הסרה */}
          {canCloseInvoice(formData.document_type) && (openBusinessInvoices.length > 0 || editingIncome?.linked_document_id) && (
            <div className="space-y-2">
              <Select 
                label="קישור לחשבונית עסקה (אופציונלי)" 
                options={[
                  { value: '', label: editingIncome?.linked_document_id ? '🔓 הסר קישור קיים' : 'ללא קישור' }, 
                  ...openBusinessInvoices.map(inv => ({ 
                    value: inv.id, 
                    label: `${inv.invoice_number || 'ללא מספר'} - ${inv.customer?.name || 'ללא לקוח'} - ${formatCurrency(inv.amount)}` 
                  }))
                ]} 
                value={formData.linked_document_id} 
                onChange={(e) => setFormData({ ...formData, linked_document_id: e.target.value })} 
              />
              {editingIncome?.linked_document_id && formData.linked_document_id === '' && (
                <Alert variant="warning">
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4" />
                    <span className="text-sm">בחירת "הסר קישור" תחזיר את חשבונית העסקה המקושרת לסטטוס פתוח</span>
                  </div>
                </Alert>
              )}
            </div>
          )}

          {isBusinessInvoice(formData.document_type) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              💡 חשבונית עסקה לא נכללת בדוח המע״מ. יש להמיר אותה לחשבונית מס בעת קבלת התשלום.
            </div>
          )}

          {isVatDocument(formData.document_type) && (
            <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
              <span className="text-sm font-medium text-gray-700">הזנת סכום:</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setInputMode('before_vat')} className={`px-3 py-1 rounded text-sm ${inputMode === 'before_vat' ? 'bg-primary-600 text-white' : 'bg-white border text-gray-700'}`}>לפני מע״מ</button>
                <button type="button" onClick={() => setInputMode('total')} className={`px-3 py-1 rounded text-sm ${inputMode === 'total' ? 'bg-primary-600 text-white' : 'bg-white border text-gray-700'}`}>כולל מע״מ</button>
              </div>
            </div>
          )}

          {isVatDocument(formData.document_type) && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={formData.vat_exempt} onChange={(e) => setFormData({ ...formData, vat_exempt: e.target.checked })} className="w-4 h-4 text-primary-600 rounded" />
              <span className="text-sm font-medium">פטור ממע״מ</span>
            </label>
          )}

          {isVatDocument(formData.document_type) && !formData.vat_exempt ? (
            <div className="grid grid-cols-3 gap-4">
              <Input label={inputMode === 'before_vat' ? 'סכום לפני מע״מ *' : 'סכום לפני מע״מ'} type="number" step="0.01" value={formData.amount_before_vat} onChange={(e) => { setInputMode('before_vat'); setFormData({ ...formData, amount_before_vat: e.target.value }) }} required={inputMode === 'before_vat'} />
              <Input label="מע״מ (18%)" type="number" step="0.01" value={formData.vat_amount} disabled className="bg-gray-50" />
              <Input label={inputMode === 'total' ? 'סכום כולל מע״מ *' : 'סכום כולל מע״מ'} type="number" step="0.01" value={formData.amount} onChange={(e) => { setInputMode('total'); setFormData({ ...formData, amount: e.target.value }) }} required={inputMode === 'total'} />
            </div>
          ) : (
            <Input label="סכום" type="number" step="0.01" value={formData.amount_before_vat} onChange={(e) => setFormData({ ...formData, amount_before_vat: e.target.value, amount: e.target.value })} required />
          )}

          <Input label="תאריך" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />

          <div className="grid grid-cols-2 gap-4">
            <Select label="תנאי תשלום" options={paymentTermsOptions} value={formData.payment_terms} onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })} />
            <Input label="תאריך לתשלום" type="date" value={formData.due_date} onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} disabled={formData.payment_terms !== '' && formData.payment_terms !== 'custom'} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Select label="קטגוריה" options={[{ value: '', label: 'בחר קטגוריה' }, ...categories.map(c => ({ value: c.id, label: c.name }))]} value={formData.category_id} onChange={(e) => setFormData({ ...formData, category_id: e.target.value })} />
            <Select label="לקוח" options={[{ value: '', label: 'בחר לקוח' }, ...customers.map(c => ({ value: c.id, label: c.name }))]} value={formData.customer_id} onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })} />
          </div>

          <Input label="מספר מסמך" value={formData.invoice_number} onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })} placeholder="מספר חשבונית / קבלה" />

          <div className="grid grid-cols-2 gap-4">
            <Select label="סטטוס תשלום" options={[{ value: 'pending', label: 'ממתין' }, { value: 'partial', label: 'שולם חלקית' }, { value: 'paid', label: 'שולם' }]} value={formData.payment_status} onChange={(e) => setFormData({ ...formData, payment_status: e.target.value as any })} />
            <Select label="אמצעי תשלום" options={paymentMethods} value={formData.payment_method} onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as PaymentMethod })} />
          </div>

          {formData.payment_status === 'paid' && (
            <Input label="תאריך תשלום" type="date" value={formData.payment_date} onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })} />
          )}

          {/* שדות מורחבים */}
          <div className="border-t pt-4 mt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">פרטים נוספים (אופציונלי)</p>
            
            <Input 
              label="מספר פרויקט/עבודה" 
              value={formData.project_number} 
              onChange={(e) => setFormData({ ...formData, project_number: e.target.value })} 
              placeholder="לדוגמה: 2024-001" 
            />

            <div className="grid grid-cols-2 gap-4 mt-4">
              <Input 
                label="מספר חשבונית מס קבלה" 
                value={formData.receipt_number} 
                onChange={(e) => setFormData({ ...formData, receipt_number: e.target.value })} 
                placeholder="מספר הקבלה" 
              />
              <Input 
                label="שם מי ששילם בפועל" 
                value={formData.actual_payer_name} 
                onChange={(e) => setFormData({ ...formData, actual_payer_name: e.target.value })} 
                placeholder="אם שונה מהלקוח" 
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit">{editingIncome ? 'עדכון' : 'הוספה'}</Button>
            <Button type="button" variant="outline" onClick={() => { setShowAddModal(false); setEditingIncome(null); resetForm() }}>ביטול</Button>
          </div>
        </form>
      </Modal>

      {/* Link Documents Modal - משופר עם ציון התאמה */}
      <Modal isOpen={showLinkModal} onClose={() => { setShowLinkModal(false); setLinkingDocument(null); setShowAllLinkedDocs(false) }} title="קישור מסמכים" size="lg">
        {linkingDocument && (
          <div className="space-y-4">
            {/* פרטי המסמך לקישור */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-2">
                {isBusinessInvoice(linkingDocument.document_type) ? 'חשבונית עסקה:' : 'חשבונית מס:'}
              </h4>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">מספר:</span>
                  <span className="font-medium mr-1">{linkingDocument.invoice_number || 'ללא'}</span>
                </div>
                <div>
                  <span className="text-gray-500">לקוח:</span>
                  <span className="font-medium mr-1">{linkingDocument.customer?.name || 'לא צוין'}</span>
                </div>
                <div>
                  <span className="text-gray-500">סכום:</span>
                  <span className="font-bold text-primary-600 mr-1">{formatCurrency(linkingDocument.amount)}</span>
                </div>
              </div>
            </div>

            {/* רשימת מסמכים לקישור */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">
                  {isBusinessInvoice(linkingDocument.document_type) 
                    ? 'בחר חשבונית מס לקישור:' 
                    : 'בחר חשבונית עסקה לקישור:'}
                </h4>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input 
                    type="checkbox" 
                    checked={showAllLinkedDocs} 
                    onChange={(e) => setShowAllLinkedDocs(e.target.checked)}
                    className="rounded"
                  />
                  הצג הכל (גם התאמות חלשות)
                </label>
              </div>

              {filteredDocsForLinking.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Info className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  <p>אין מסמכים מתאימים לקישור</p>
                  {!showAllLinkedDocs && relevantDocsForLinking.length > 0 && (
                    <p className="text-sm mt-1">
                      יש {relevantDocsForLinking.length} מסמכים עם התאמה חלשה - 
                      <button 
                        onClick={() => setShowAllLinkedDocs(true)}
                        className="text-primary-600 underline mr-1"
                      >
                        הצג אותם
                      </button>
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {filteredDocsForLinking.map((doc: any) => (
                    <button 
                      key={doc.id} 
                      onClick={() => {
                        if (isBusinessInvoice(linkingDocument.document_type)) {
                          handleLinkDocument(linkingDocument.id, doc.id)
                        } else {
                          handleLinkDocument(doc.id, linkingDocument.id)
                        }
                      }} 
                      className={`w-full text-right p-4 border rounded-lg transition-colors ${
                        doc.matchScore >= 80 
                          ? 'hover:bg-green-50 hover:border-green-300 border-green-200' 
                          : doc.matchScore >= 50 
                          ? 'hover:bg-blue-50 hover:border-blue-300 border-blue-200' 
                          : 'hover:bg-gray-50 hover:border-gray-300 border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{getDocumentTypeLabel(doc.document_type)}</span>
                            {doc.matchScore >= 80 && (
                              <Badge variant="success" size="sm">התאמה מצוינת</Badge>
                            )}
                            {doc.matchScore >= 50 && doc.matchScore < 80 && (
                              <Badge variant="info" size="sm">התאמה טובה</Badge>
                            )}
                            {doc.matchScore < 50 && (
                              <Badge variant="warning" size="sm">התאמה חלשה</Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {doc.invoice_number && <span>מס׳ {doc.invoice_number} | </span>}
                            {formatDateShort(doc.date)}
                            {doc.customer?.name && <span> | {doc.customer.name}</span>}
                          </div>
                        </div>
                        <div className="text-left">
                          <span className={`font-bold text-lg ${
                            doc.amountDiffPercent <= 1 ? 'text-green-600' : 
                            doc.amountDiffPercent <= 5 ? 'text-blue-600' : 'text-amber-600'
                          }`}>
                            {formatCurrency(doc.amount)}
                          </span>
                          {doc.amountDiff > 0 && (
                            <div className="text-xs text-gray-500">
                              הפרש: {formatCurrency(doc.amountDiff)} ({doc.amountDiffPercent.toFixed(1)}%)
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* פרטי התאמה */}
                      <div className="flex gap-4 mt-2 text-xs text-gray-500">
                        <span className={doc.sameCustomer ? 'text-green-600' : ''}>
                          {doc.sameCustomer ? '✓ אותו לקוח' : '✗ לקוח שונה'}
                        </span>
                        <span>
                          {Math.round(doc.daysDiff)} ימים הפרש
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => { setShowLinkModal(false); setLinkingDocument(null); setShowAllLinkedDocs(false) }}>ביטול</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Import Modal */}
      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} size="xl">
        <ExcelImport type="income" requiredFields={importRequiredFields} onImport={handleImport} onClose={() => setShowImportModal(false)} />
      </Modal>

      {/* Bulk Update Modal */}
      <Modal isOpen={showBulkUpdateModal} onClose={() => { setShowBulkUpdateModal(false); setBulkUpdateData({ payment_method: '', category_id: '', customer_id: '', payment_status: '' }) }} title={`עדכון ${selectedIds.size} הכנסות`}>
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">בחרי את השדות לעדכון:</p>
          <Select label="אמצעי תשלום" options={[{ value: '', label: '-- ללא שינוי --' }, ...paymentMethods.filter(p => p.value !== '')]} value={bulkUpdateData.payment_method} onChange={(e) => setBulkUpdateData(prev => ({ ...prev, payment_method: e.target.value }))} />
          <Select label="קטגוריה" options={[{ value: '', label: '-- ללא שינוי --' }, ...categories.map(c => ({ value: c.id, label: c.name }))]} value={bulkUpdateData.category_id} onChange={(e) => setBulkUpdateData(prev => ({ ...prev, category_id: e.target.value }))} />
          <Select label="לקוח" options={[{ value: '', label: '-- ללא שינוי --' }, ...customers.map(c => ({ value: c.id, label: c.name }))]} value={bulkUpdateData.customer_id} onChange={(e) => setBulkUpdateData(prev => ({ ...prev, customer_id: e.target.value }))} />
          <Select label="סטטוס תשלום" options={[{ value: '', label: '-- ללא שינוי --' }, { value: 'pending', label: 'ממתין' }, { value: 'partial', label: 'שולם חלקית' }, { value: 'paid', label: 'שולם' }]} value={bulkUpdateData.payment_status} onChange={(e) => setBulkUpdateData(prev => ({ ...prev, payment_status: e.target.value }))} />
          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={handleBulkUpdate}><Check className="w-4 h-4" />עדכן {selectedIds.size} הכנסות</Button>
            <Button variant="outline" onClick={() => { setShowBulkUpdateModal(false); setBulkUpdateData({ payment_method: '', category_id: '', customer_id: '', payment_status: '' }) }}>ביטול</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
