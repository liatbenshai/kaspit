'use client'

import { useEffect, useState } from 'react'
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
import { Plus, Upload, Search, Pencil, Trash2, FileText, Link2, AlertTriangle, Check, X, Square, CheckSquare, Filter, Clock } from 'lucide-react'
import type { Income, Category, Customer, IncomeDocumentType, DocumentStatus } from '@/types'

const VAT_RATE = 0.18

// סוגי אמצעי תשלום
type PaymentMethod = 'bank_transfer' | 'credit_card' | 'cash' | 'check' | 'bit' | ''

const paymentMethods = [
  { value: '', label: 'בחר אמצעי תשלום' },
  { value: 'bank_transfer', label: 'העברה בנקאית' },
  { value: 'credit_card', label: 'כרטיס אשראי' },
  { value: 'cash', label: 'מזומן' },
  { value: 'check', label: 'צ׳ק' },
  { value: 'bit', label: 'ביט / פייבוקס' },
]

// תנאי תשלום
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

// חישוב תאריך לתשלום
const calculateDueDate = (invoiceDate: string, terms: string): string => {
  if (!invoiceDate || !terms) return ''
  
  const date = new Date(invoiceDate)
  
  // חישוב סוף החודש
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0)
  
  switch (terms) {
    case 'immediate':
      return invoiceDate
    case 'eom':
      return endOfMonth.toISOString().split('T')[0]
    case 'eom_plus_30':
      endOfMonth.setDate(endOfMonth.getDate() + 30)
      return endOfMonth.toISOString().split('T')[0]
    case 'eom_plus_45':
      endOfMonth.setDate(endOfMonth.getDate() + 45)
      return endOfMonth.toISOString().split('T')[0]
    case 'eom_plus_60':
      endOfMonth.setDate(endOfMonth.getDate() + 60)
      return endOfMonth.toISOString().split('T')[0]
    case 'eom_plus_90':
      endOfMonth.setDate(endOfMonth.getDate() + 90)
      return endOfMonth.toISOString().split('T')[0]
    case 'net_30':
      date.setDate(date.getDate() + 30)
      return date.toISOString().split('T')[0]
    case 'net_45':
      date.setDate(date.getDate() + 45)
      return date.toISOString().split('T')[0]
    case 'net_60':
      date.setDate(date.getDate() + 60)
      return date.toISOString().split('T')[0]
    default:
      return '' // custom
  }
}

// בדיקה אם עבר תאריך התשלום
const isOverdue = (dueDate: string | null, paymentStatus: string): boolean => {
  if (!dueDate || paymentStatus === 'paid') return false
  return new Date(dueDate) < new Date()
}

// סוגי מסמכים להכנסות
const incomeDocumentTypes = [
  { value: 'invoice', label: 'חשבונית עסקה' },
  { value: 'tax_invoice', label: 'חשבונית מס' },
  { value: 'tax_invoice_receipt', label: 'חשבונית מס קבלה' },
  { value: 'receipt', label: 'קבלה' },
  { value: 'credit_note', label: 'הודעת זיכוי' },
]

const documentStatusLabels: Record<DocumentStatus, string> = {
  open: 'פתוח',
  closed: 'סגור',
  cancelled: 'מבוטל',
}

const documentStatusColors: Record<DocumentStatus, string> = {
  open: 'warning',
  closed: 'success',
  cancelled: 'default',
}

const getDocumentTypeLabel = (type: string) => {
  return incomeDocumentTypes.find(d => d.value === type)?.label || type
}

// האם סוג המסמך מחייב מע"מ (נכלל בדוח מע"מ)
const isVatDocument = (type: string) => {
  return ['tax_invoice', 'tax_invoice_receipt', 'credit_note'].includes(type)
}

// האם זו חשבונית עסקה שצריכה קישור
const isBusinessInvoice = (type: string) => type === 'invoice'

// האם מסמך יכול לסגור חשבונית עסקה
const canCloseInvoice = (type: string) => {
  return ['tax_invoice', 'tax_invoice_receipt'].includes(type)
}

export default function IncomePage() {
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

  // בחירה מרובה
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBulkUpdateModal, setShowBulkUpdateModal] = useState(false)
  const [bulkUpdateData, setBulkUpdateData] = useState({
    payment_method: '',
    category_id: '',
    customer_id: '',
    payment_status: '',
  })
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    category_id: '',
    customer_id: '',
    amount_before_vat: '',
    vat_amount: '',
    amount: '',
    vat_exempt: false,
    document_type: 'tax_invoice' as IncomeDocumentType,
    linked_document_id: '',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    payment_terms: '',
    description: '',
    invoice_number: '',
    payment_status: 'pending' as 'pending' | 'partial' | 'paid',
    payment_date: '',
    payment_method: '' as PaymentMethod,
  })

  const [inputMode, setInputMode] = useState<'before_vat' | 'total'>('before_vat')

  useEffect(() => {
    loadData()
  }, [])

  // חישוב מע"מ אוטומטי
  useEffect(() => {
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

  // חישוב תאריך לתשלום אוטומטי
  useEffect(() => {
    if (formData.payment_terms && formData.payment_terms !== 'custom' && formData.date) {
      const calculatedDueDate = calculateDueDate(formData.date, formData.payment_terms)
      if (calculatedDueDate) {
        setFormData(prev => ({
          ...prev,
          due_date: calculatedDueDate
        }))
      }
    }
  }, [formData.payment_terms, formData.date])

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
      // קביעת סטטוס מסמך
      let documentStatus: DocumentStatus = 'open'
      if (isBusinessInvoice(formData.document_type)) {
        documentStatus = 'open' // חשבונית עסקה תמיד מתחילה פתוחה
      } else if (!isBusinessInvoice(formData.document_type)) {
        documentStatus = 'closed' // מסמכי מס נחשבים סגורים
      }

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
      }

      if (editingIncome) {
        await supabase
          .from('income')
          .update(incomeData)
          .eq('id', editingIncome.id)
      } else {
        // הוספת מסמך חדש
        const { data: newIncome } = await supabase
          .from('income')
          .insert(incomeData)
          .select()
          .single()

        // אם זה מסמך שסוגר חשבונית עסקה
        if (newIncome && formData.linked_document_id && canCloseInvoice(formData.document_type)) {
          await supabase
            .from('income')
            .update({ document_status: 'closed' })
            .eq('id', formData.linked_document_id)
        }
      }

      setShowAddModal(false)
      setEditingIncome(null)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving income:', error)
    }
  }

  const handleLinkDocument = async (businessInvoiceId: string, taxDocumentId: string) => {
    try {
      // עדכון חשבונית המס עם הקישור
      await supabase
        .from('income')
        .update({ linked_document_id: businessInvoiceId })
        .eq('id', taxDocumentId)

      // סגירת חשבונית העסקה
      await supabase
        .from('income')
        .update({ document_status: 'closed' })
        .eq('id', businessInvoiceId)

      setShowLinkModal(false)
      setLinkingDocument(null)
      loadData()
    } catch (error) {
      console.error('Error linking documents:', error)
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
    })
    setShowAddModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק מסמך זה?')) return
    await supabase.from('income').delete().eq('id', id)
    loadData()
  }

  // מיפוי ערכים מעברית לאנגלית
  const documentTypeMap: Record<string, string> = {
    'חשבונית מס': 'tax_invoice',
    'חשבונית מס קבלה': 'tax_invoice_receipt',
    'הודעת זיכוי': 'credit_note',
    'חשבונית עסקה': 'invoice',
    'קבלה': 'receipt',
    'tax_invoice': 'tax_invoice',
    'tax_invoice_receipt': 'tax_invoice_receipt',
    'credit_note': 'credit_note',
    'invoice': 'invoice',
    'receipt': 'receipt',
  }

  const statusMap: Record<string, string> = {
    'שולם': 'paid',
    'ממתין': 'pending',
    'שולם חלקית': 'partial',
    'paid': 'paid',
    'pending': 'pending',
    'partial': 'partial',
  }

  const parseBoolean = (value: any): boolean => {
    if (value === true || value === 'true' || value === 'כן' || value === 'yes') return true
    return false
  }

  const translateValue = (value: any, map: Record<string, string>, defaultValue: string): string => {
    if (!value) return defaultValue
    const strValue = String(value).trim()
    return map[strValue] || defaultValue
  }

  // ========================================
  // פונקציית ייבוא מתוקנת עם קיזוז אוטומטי
  // ========================================
  const handleImport = async (data: Record<string, any>[]) => {
    if (!companyId) return

    // מציאת קטגוריה לפי שם
    const findCategoryId = (categoryName: string | undefined): string | null => {
      if (!categoryName) return null
      const cat = categories.find(c => 
        c.name === categoryName || 
        c.name.includes(categoryName) || 
        categoryName.includes(c.name)
      )
      return cat?.id || null
    }

    // מציאת לקוח לפי שם
    const findCustomerId = (customerName: string | undefined): string | null => {
      if (!customerName) return null
      const customer = customers.find(c => 
        c.name === customerName || 
        c.name.includes(customerName) || 
        customerName.includes(c.name)
      )
      return customer?.id || null
    }

    // שלב 1: הכנת רשומות לייבוא
    const incomeRecords = data.map(row => {
      const amountBeforeVat = parseFloat(row.amount_before_vat) || 0
      const vatExempt = parseBoolean(row.vat_exempt)
      const docType = translateValue(row.document_type, documentTypeMap, 'tax_invoice')
      const paymentStatus = translateValue(row.payment_status, statusMap, 'pending')
      const hasVat = !vatExempt && isVatDocument(docType)
      const vatAmount = hasVat ? Math.round(amountBeforeVat * VAT_RATE * 100) / 100 : 0
      const amount = Math.round((amountBeforeVat + vatAmount) * 100) / 100
      const categoryId = findCategoryId(row.category_name)
      const customerId = findCustomerId(row.customer_name)

      return {
        company_id: companyId,
        category_id: categoryId,
        customer_id: customerId,
        amount: amount,
        amount_before_vat: amountBeforeVat,
        vat_amount: vatAmount,
        vat_exempt: vatExempt,
        document_type: docType,
        document_status: isBusinessInvoice(docType) ? 'open' : 'closed',
        date: row.date || new Date().toISOString().split('T')[0],
        description: row.description || null,
        invoice_number: row.invoice_number || null,
        payment_status: paymentStatus,
        // שדה חדש: מספר חשבונית עסקה מקושרת (לקיזוז)
        _linked_invoice_number: row.linked_invoice_number || null,
      }
    })

    // שלב 2: ייבוא הרשומות
    const { data: insertedRecords, error } = await supabase
      .from('income')
      .insert(incomeRecords.map(r => {
        // הסרת שדה הקישור הזמני לפני השמירה
        const { _linked_invoice_number, ...record } = r
        return record
      }))
      .select()

    if (error) throw error

    // שלב 3: קיזוז אוטומטי - קישור חשבוניות מס לחשבוניות עסקה
    if (insertedRecords && insertedRecords.length > 0) {
      await performAutoLinking(incomeRecords, insertedRecords)
    }

    loadData()
    
    // הודעת הצלחה עם פירוט
    const businessInvoiceCount = incomeRecords.filter(r => isBusinessInvoice(r.document_type)).length
    const taxDocCount = incomeRecords.filter(r => canCloseInvoice(r.document_type)).length
    const linkedCount = incomeRecords.filter(r => r._linked_invoice_number).length
    
    setSuccessMessage(
      `יובאו ${incomeRecords.length} מסמכים בהצלחה! ` +
      `(${businessInvoiceCount} חשבוניות עסקה, ${taxDocCount} חשבוניות מס` +
      (linkedCount > 0 ? `, ${linkedCount} קושרו אוטומטית` : '') + ')'
    )
  }

  // ========================================
  // פונקציית קיזוז אוטומטי
  // ========================================
  const performAutoLinking = async (
    originalRecords: any[], 
    insertedRecords: Income[]
  ) => {
    // מיפוי מספרי חשבוניות ל-IDs
    const invoiceNumberToId: Record<string, string> = {}
    insertedRecords.forEach(record => {
      if (record.invoice_number && isBusinessInvoice(record.document_type)) {
        invoiceNumberToId[record.invoice_number] = record.id
      }
    })

    // גם מחפש חשבוניות עסקה קיימות במערכת
    const existingBusinessInvoices = income.filter(
      i => isBusinessInvoice(i.document_type) && i.document_status === 'open'
    )
    existingBusinessInvoices.forEach(inv => {
      if (inv.invoice_number) {
        invoiceNumberToId[inv.invoice_number] = inv.id
      }
    })

    const linksToCreate: { taxDocId: string; businessInvoiceId: string }[] = []
    const invoicesToClose: string[] = []

    // מעבר על הרשומות המיובאות
    for (let i = 0; i < originalRecords.length; i++) {
      const originalRecord = originalRecords[i]
      const insertedRecord = insertedRecords[i]

      if (!insertedRecord || !canCloseInvoice(insertedRecord.document_type)) continue

      let matchedBusinessInvoiceId: string | null = null

      // אפשרות 1: קישור ישיר לפי מספר חשבונית עסקה שצוין בקובץ
      if (originalRecord._linked_invoice_number) {
        matchedBusinessInvoiceId = invoiceNumberToId[originalRecord._linked_invoice_number] || null
      }

      // אפשרות 2: התאמה חכמה לפי סכום, לקוח ותאריך (אם לא צוין קישור)
      if (!matchedBusinessInvoiceId) {
        matchedBusinessInvoiceId = findSmartMatch(insertedRecord, existingBusinessInvoices)
      }

      if (matchedBusinessInvoiceId) {
        linksToCreate.push({
          taxDocId: insertedRecord.id,
          businessInvoiceId: matchedBusinessInvoiceId
        })
        invoicesToClose.push(matchedBusinessInvoiceId)
      }
    }

    // ביצוע הקישורים
    for (const link of linksToCreate) {
      await supabase
        .from('income')
        .update({ linked_document_id: link.businessInvoiceId })
        .eq('id', link.taxDocId)
    }

    // סגירת חשבוניות העסקה שקושרו
    if (invoicesToClose.length > 0) {
      await supabase
        .from('income')
        .update({ document_status: 'closed' })
        .in('id', invoicesToClose)
    }

    console.log(`Auto-linked ${linksToCreate.length} documents`)
  }

  // ========================================
  // התאמה חכמה לפי סכום, לקוח ותאריך
  // ========================================
  const findSmartMatch = (
    taxDoc: Income, 
    businessInvoices: Income[]
  ): string | null => {
    const candidates = businessInvoices.filter(inv => {
      // התאמת סכום (סטייה של עד 1 ש"ח)
      const amountMatch = Math.abs(inv.amount - taxDoc.amount) <= 1
      
      // התאמת לקוח (אם יש)
      const customerMatch = !taxDoc.customer_id || 
                            !inv.customer_id || 
                            taxDoc.customer_id === inv.customer_id

      // התאמת תאריך (עד 60 יום הבדל)
      const taxDate = new Date(taxDoc.date)
      const invDate = new Date(inv.date)
      const daysDiff = Math.abs((taxDate.getTime() - invDate.getTime()) / (1000 * 60 * 60 * 24))
      const dateMatch = daysDiff <= 60

      return amountMatch && customerMatch && dateMatch
    })

    // אם יש התאמה אחת בדיוק - החזר אותה
    if (candidates.length === 1) {
      return candidates[0].id
    }

    // אם יש כמה התאמות - בחר את הקרובה ביותר בתאריך
    if (candidates.length > 1) {
      const taxDate = new Date(taxDoc.date)
      candidates.sort((a, b) => {
        const diffA = Math.abs(new Date(a.date).getTime() - taxDate.getTime())
        const diffB = Math.abs(new Date(b.date).getTime() - taxDate.getTime())
        return diffA - diffB
      })
      return candidates[0].id
    }

    return null
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
      linked_document_id: '',
      date: new Date().toISOString().split('T')[0],
      due_date: '',
      payment_terms: '',
      description: '',
      invoice_number: '',
      payment_status: 'pending',
      payment_date: '',
      payment_method: '',
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
    
    // סינון לפי חודש ושנה
    const itemDate = new Date(item.date)
    const matchesMonth = !filterMonth || (itemDate.getMonth() + 1) === parseInt(filterMonth)
    const matchesYear = !filterYear || itemDate.getFullYear() === parseInt(filterYear)
    
    return matchesSearch && matchesStatus && matchesDocType && matchesDocStatus && 
           matchesPaymentMethod && matchesCategory && matchesCustomer && matchesMonth && matchesYear
  })

  // שנים זמינות לסינון
  const availableYears = Array.from(new Set(income.map(i => new Date(i.date).getFullYear()))).sort((a, b) => b - a)

  // פונקציות בחירה מרובה
  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredIncome.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredIncome.map(i => i.id)))
    }
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  // עדכון המוני
  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0) return

    // בניית אובייקט העדכון רק עם שדות שנבחרו
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
      const { error } = await supabase
        .from('income')
        .update(updateData)
        .in('id', Array.from(selectedIds))

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

  const resetBulkUpdate = () => {
    setBulkUpdateData({ payment_method: '', category_id: '', customer_id: '', payment_status: '' })
  }

  // איפוס כל הסינונים
  const clearFilters = () => {
    setSearchTerm('')
    setFilterStatus('')
    setFilterDocType('')
    setFilterDocStatus('')
    setFilterPaymentMethod('')
    setFilterCategory('')
    setFilterCustomer('')
    setFilterMonth('')
    setFilterYear('')
  }

  const hasActiveFilters = searchTerm || filterStatus || filterDocType || filterDocStatus || 
                           filterPaymentMethod || filterCategory || filterCustomer || filterMonth || filterYear

  // חשבוניות עסקה פתוחות
  const openBusinessInvoices = income.filter(
    i => i.document_type === 'invoice' && i.document_status === 'open'
  )

  // חשבוניות מס שיכולות לסגור חשבונית עסקה (ללא קישור)
  const unlinkedTaxDocuments = income.filter(
    i => canCloseInvoice(i.document_type) && !i.linked_document_id
  )

  const totalAmount = filteredIncome.reduce((sum, item) => sum + Number(item.amount), 0)
  const totalVat = filteredIncome
    .filter(i => isVatDocument(i.document_type))
    .reduce((sum, item) => sum + Number(item.vat_amount || 0), 0)
  const totalBeforeVat = filteredIncome.reduce((sum, item) => sum + Number(item.amount_before_vat || item.amount), 0)

  // חישוב הכנסות ממתינות לתשלום (פתוחות)
  const pendingPayments = income.filter(i => 
    i.payment_status !== 'paid' && i.document_status === 'open'
  )
  const totalPending = pendingPayments.reduce((sum, item) => sum + Number(item.amount), 0)

  // חישוב הכנסות באיחור
  const overduePayments = income.filter(i => isOverdue((i as any).due_date, i.payment_status))
  const totalOverdue = overduePayments.reduce((sum, item) => sum + Number(item.amount), 0)

  // חישוב הכנסות עתידיות (עם תאריך לתשלום בעתיד)
  const futurePayments = income.filter(i => 
    (i as any).due_date && 
    new Date((i as any).due_date) > new Date() && 
    i.payment_status !== 'paid'
  )
  const totalFuture = futurePayments.reduce((sum, item) => sum + Number(item.amount), 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ========================================
  // שדות חובה לייבוא - מעודכן!
  // ========================================
  const importRequiredFields = [
    { key: 'amount_before_vat', label: 'סכום (לפני מע״מ)', required: true },
    { key: 'date', label: 'תאריך', required: true },
    { key: 'document_type', label: 'סוג מסמך', required: true }, // שונה ל-required!
    { key: 'invoice_number', label: 'מספר מסמך', required: false },
    { key: 'linked_invoice_number', label: 'מספר חשבונית עסקה מקושרת', required: false }, // חדש!
    { key: 'customer_name', label: 'לקוח', required: false }, // חדש!
    { key: 'category_name', label: 'קטגוריה', required: false },
    { key: 'description', label: 'תיאור', required: false },
    { key: 'vat_exempt', label: 'פטור ממע״מ', required: false },
    { key: 'payment_status', label: 'סטטוס', required: false },
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

      {/* Alert for open business invoices */}
      {openBusinessInvoices.length > 0 && (
        <Alert variant="warning">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            <span>
              יש {openBusinessInvoices.length} חשבוניות עסקה פתוחות שטרם הומרו לחשבונית מס
            </span>
          </div>
        </Alert>
      )}

      {error && (
        <Alert variant="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {successMessage && (
        <Alert variant="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <Card padding="md" className="bg-primary-50 border-primary-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckSquare className="w-5 h-5 text-primary-600" />
              <span className="font-medium text-primary-900">
                נבחרו {selectedIds.size} הכנסות
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setShowBulkUpdateModal(true)}>
                עדכון שדות
              </Button>
              <Button size="sm" variant="outline" onClick={clearSelection}>
                ביטול בחירה
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card padding="md">
        <div className="space-y-4">
          {/* שורה ראשית - חיפוש + כפתור סינון */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="חיפוש לפי תיאור, מספר מסמך או לקוח..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>
            <Button 
              variant={showAdvancedFilters ? 'primary' : 'outline'} 
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            >
              <Filter className="w-4 h-4" />
              סינון {hasActiveFilters && `(${[filterStatus, filterDocType, filterDocStatus, filterPaymentMethod, filterCategory, filterCustomer, filterMonth, filterYear].filter(Boolean).length})`}
            </Button>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="w-4 h-4" />
                נקה
              </Button>
            )}
          </div>

          {/* סינונים מתקדמים - מוסתרים כברירת מחדל */}
          {showAdvancedFilters && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 pt-3 border-t">
              <Select
                options={[
                  { value: '', label: 'סוג מסמך' },
                  ...incomeDocumentTypes
                ]}
                value={filterDocType}
                onChange={(e) => setFilterDocType(e.target.value)}
              />
              <Select
                options={[
                  { value: '', label: 'סטטוס מסמך' },
                  { value: 'open', label: 'פתוח' },
                  { value: 'closed', label: 'סגור' },
                  { value: 'cancelled', label: 'מבוטל' },
                ]}
                value={filterDocStatus}
                onChange={(e) => setFilterDocStatus(e.target.value)}
              />
              <Select
                options={[
                  { value: '', label: 'סטטוס תשלום' },
                  { value: 'pending', label: 'ממתין' },
                  { value: 'partial', label: 'שולם חלקית' },
                  { value: 'paid', label: 'שולם' },
                ]}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              />
              <Select
                options={[
                  { value: '', label: 'אמצעי תשלום' },
                  { value: 'bank_transfer', label: 'העברה בנקאית' },
                  { value: 'credit_card', label: 'כרטיס אשראי' },
                  { value: 'cash', label: 'מזומן' },
                  { value: 'check', label: 'צ׳ק' },
                  { value: 'bit', label: 'ביט / פייבוקס' },
                ]}
                value={filterPaymentMethod}
                onChange={(e) => setFilterPaymentMethod(e.target.value)}
              />
              <Select
                options={[
                  { value: '', label: 'קטגוריה' },
                  ...categories.map(c => ({ value: c.id, label: c.name }))
                ]}
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              />
              <Select
                options={[
                  { value: '', label: 'לקוח' },
                  ...customers.map(c => ({ value: c.id, label: c.name }))
                ]}
                value={filterCustomer}
                onChange={(e) => setFilterCustomer(e.target.value)}
              />
              <Select
                options={[
                  { value: '', label: 'חודש' },
                  { value: '1', label: 'ינואר' },
                  { value: '2', label: 'פברואר' },
                  { value: '3', label: 'מרץ' },
                  { value: '4', label: 'אפריל' },
                  { value: '5', label: 'מאי' },
                  { value: '6', label: 'יוני' },
                  { value: '7', label: 'יולי' },
                  { value: '8', label: 'אוגוסט' },
                  { value: '9', label: 'ספטמבר' },
                  { value: '10', label: 'אוקטובר' },
                  { value: '11', label: 'נובמבר' },
                  { value: '12', label: 'דצמבר' },
                ]}
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              />
              <Select
                options={[
                  { value: '', label: 'שנה' },
                  ...availableYears.map(y => ({ value: y.toString(), label: y.toString() }))
                ]}
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Summary */}
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
            <p className="text-sm text-danger-600 flex items-center gap-1">
              <Clock className="w-4 h-4" />
              באיחור!
            </p>
            <p className="text-xl font-bold text-danger-700">{formatCurrency(totalOverdue)}</p>
            <p className="text-xs text-danger-600">{overduePayments.length} מסמכים</p>
          </div>
        )}
      </div>

      {/* Table */}
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <button
                  onClick={toggleSelectAll}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  {selectedIds.size === filteredIncome.length && filteredIncome.length > 0 ? (
                    <CheckSquare className="w-5 h-5 text-primary-600" />
                  ) : (
                    <Square className="w-5 h-5 text-gray-400" />
                  )}
                </button>
              </TableHead>
              <TableHead>תאריך</TableHead>
              <TableHead>סוג מסמך</TableHead>
              <TableHead>מס׳</TableHead>
              <TableHead>תיאור</TableHead>
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
                <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                  אין מסמכים להצגה
                </TableCell>
              </TableRow>
            ) : (
              filteredIncome.map((item) => (
                <TableRow 
                  key={item.id} 
                  className={`${item.document_status === 'cancelled' ? 'opacity-50' : ''} ${selectedIds.has(item.id) ? 'bg-primary-50' : ''}`}
                >
                  <TableCell>
                    <button
                      onClick={() => toggleSelectItem(item.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {selectedIds.has(item.id) ? (
                        <CheckSquare className="w-5 h-5 text-primary-600" />
                      ) : (
                        <Square className="w-5 h-5 text-gray-400" />
                      )}
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
                      <p className="font-medium">{item.description || '-'}</p>
                      {item.linked_document_id && (
                        <p className="text-xs text-primary-600 flex items-center gap-1">
                          <Link2 className="w-3 h-3" />
                          מקושר לחשבונית עסקה
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{item.customer?.name || '-'}</TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(item.amount)}
                  </TableCell>
                  <TableCell>
                    {(item as any).due_date ? (
                      <div className={`flex items-center gap-1 ${isOverdue((item as any).due_date, item.payment_status) ? 'text-danger-600' : ''}`}>
                        {isOverdue((item as any).due_date, item.payment_status) && (
                          <Clock className="w-4 h-4" />
                        )}
                        <span className="text-sm">{formatDateShort((item as any).due_date)}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {(item as any).payment_method ? (
                      <Badge variant="default">
                        {paymentMethods.find(p => p.value === (item as any).payment_method)?.label || (item as any).payment_method}
                      </Badge>
                    ) : (
                      <span className="text-gray-400 text-sm">לא הוגדר</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <Badge variant={documentStatusColors[item.document_status] as any} size="sm">
                        {documentStatusLabels[item.document_status]}
                      </Badge>
                      <Badge variant={getStatusColor(item.payment_status) as any} size="sm">
                        {translateStatus(item.payment_status)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {/* Link button for open business invoices */}
                      {isBusinessInvoice(item.document_type) && item.document_status === 'open' && (
                        <button
                          onClick={() => {
                            setLinkingDocument(item)
                            setShowLinkModal(true)
                          }}
                          className="p-1 text-primary-500 hover:text-primary-700"
                          title="קשר לחשבונית מס"
                        >
                          <Link2 className="w-4 h-4" />
                        </button>
                      )}
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
        title={editingIncome ? 'עריכת מסמך' : 'הוספת מסמך'}
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

          {/* Link to business invoice - only for tax documents */}
          {canCloseInvoice(formData.document_type) && openBusinessInvoices.length > 0 && !editingIncome && (
            <Select
              label="קישור לחשבונית עסקה (אופציונלי)"
              options={[
                { value: '', label: 'ללא קישור' },
                ...openBusinessInvoices.map(inv => ({
                  value: inv.id,
                  label: `${inv.invoice_number || 'ללא מספר'} - ${inv.description || ''} - ${formatCurrency(inv.amount)}`
                }))
              ]}
              value={formData.linked_document_id}
              onChange={(e) => setFormData({ ...formData, linked_document_id: e.target.value })}
            />
          )}

          {/* Info about document type */}
          {isBusinessInvoice(formData.document_type) && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
              💡 חשבונית עסקה לא נכללת בדוח המע״מ. יש להמיר אותה לחשבונית מס בעת קבלת התשלום.
            </div>
          )}

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

          {/* תנאי תשלום ותאריך לתשלום */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="תנאי תשלום"
              options={paymentTermsOptions}
              value={formData.payment_terms}
              onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
            />
            <Input
              label="תאריך לתשלום"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              disabled={formData.payment_terms !== '' && formData.payment_terms !== 'custom'}
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
            <Select
              label="אמצעי תשלום"
              options={paymentMethods}
              value={formData.payment_method}
              onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as PaymentMethod })}
            />
          </div>

          {formData.payment_status === 'paid' && (
            <Input
              label="תאריך תשלום"
              type="date"
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
            />
          )}

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

      {/* Link Document Modal */}
      <Modal
        isOpen={showLinkModal}
        onClose={() => {
          setShowLinkModal(false)
          setLinkingDocument(null)
        }}
        title="קישור חשבונית עסקה לחשבונית מס"
      >
        {linkingDocument && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium mb-2">חשבונית עסקה:</h4>
              <p>מספר: {linkingDocument.invoice_number || 'ללא'}</p>
              <p>תיאור: {linkingDocument.description || '-'}</p>
              <p>סכום: {formatCurrency(linkingDocument.amount)}</p>
            </div>

            <div>
              <h4 className="font-medium mb-2">בחר חשבונית מס לקישור:</h4>
              {unlinkedTaxDocuments.length === 0 ? (
                <p className="text-gray-500">אין חשבוניות מס זמינות לקישור</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {unlinkedTaxDocuments.map(doc => (
                    <button
                      key={doc.id}
                      onClick={() => handleLinkDocument(linkingDocument.id, doc.id)}
                      className="w-full text-right p-3 border rounded-lg hover:bg-primary-50 hover:border-primary-300 transition-colors"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{getDocumentTypeLabel(doc.document_type)}</span>
                        <span className="text-success-600 font-bold">{formatCurrency(doc.amount)}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {doc.invoice_number && <span>מס׳ {doc.invoice_number} | </span>}
                        {formatDateShort(doc.date)}
                        {doc.description && <span> | {doc.description}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowLinkModal(false)
                  setLinkingDocument(null)
                }}
              >
                ביטול
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Import Modal - עודכן עם שדות חדשים */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        size="xl"
      >
        <ExcelImport
          type="income"
          requiredFields={importRequiredFields}
          onImport={handleImport}
          onClose={() => setShowImportModal(false)}
        />
      </Modal>

      {/* Bulk Update Modal */}
      <Modal
        isOpen={showBulkUpdateModal}
        onClose={() => {
          setShowBulkUpdateModal(false)
          resetBulkUpdate()
        }}
        title={`עדכון ${selectedIds.size} הכנסות`}
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            בחרי את השדות לעדכון. רק שדות עם ערך נבחר יעודכנו:
          </p>
          
          <Select
            label="אמצעי תשלום"
            options={[
              { value: '', label: '-- ללא שינוי --' },
              ...paymentMethods.filter(p => p.value !== '')
            ]}
            value={bulkUpdateData.payment_method}
            onChange={(e) => setBulkUpdateData(prev => ({ ...prev, payment_method: e.target.value }))}
          />
          
          <Select
            label="קטגוריה"
            options={[
              { value: '', label: '-- ללא שינוי --' },
              ...categories.map(c => ({ value: c.id, label: c.name }))
            ]}
            value={bulkUpdateData.category_id}
            onChange={(e) => setBulkUpdateData(prev => ({ ...prev, category_id: e.target.value }))}
          />
          
          <Select
            label="לקוח"
            options={[
              { value: '', label: '-- ללא שינוי --' },
              ...customers.map(c => ({ value: c.id, label: c.name }))
            ]}
            value={bulkUpdateData.customer_id}
            onChange={(e) => setBulkUpdateData(prev => ({ ...prev, customer_id: e.target.value }))}
          />
          
          <Select
            label="סטטוס תשלום"
            options={[
              { value: '', label: '-- ללא שינוי --' },
              { value: 'pending', label: 'ממתין' },
              { value: 'partial', label: 'שולם חלקית' },
              { value: 'paid', label: 'שולם' },
            ]}
            value={bulkUpdateData.payment_status}
            onChange={(e) => setBulkUpdateData(prev => ({ ...prev, payment_status: e.target.value }))}
          />

          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={handleBulkUpdate}>
              <Check className="w-4 h-4" />
              עדכן {selectedIds.size} הכנסות
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkUpdateModal(false)
                resetBulkUpdate()
              }}
            >
              ביטול
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
