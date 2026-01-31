'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDateShort, cn } from '@/lib/utils'
import { 
  CheckCircle, 
  XCircle, 
  ArrowLeftRight, 
  Search,
  Building2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Check,
  X,
  RefreshCw,
  Plus,
  ArrowRight,
  Banknote,
  CreditCard,
  Users,
  FileText
} from 'lucide-react'
import type { BankTransaction, Income, Expense, Category, Supplier, Customer } from '@/types'

interface MatchSuggestion {
  type: 'income' | 'expense'
  item: Income | Expense
  score: number
  reasons: string[]
}

interface UnmatchedTransaction extends BankTransaction {
  suggestions?: MatchSuggestion[]
}

export default function ReconciliationPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [unmatchedTransactions, setUnmatchedTransactions] = useState<UnmatchedTransaction[]>([])
  const [matchedCount, setMatchedCount] = useState(0)
  const [selectedTransaction, setSelectedTransaction] = useState<UnmatchedTransaction | null>(null)
  const [showMatchModal, setShowMatchModal] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [manualSearch, setManualSearch] = useState('')
  const [showAllItems, setShowAllItems] = useState(false)
  
  // טאב פעיל במודאל: 'suggestions' | 'search' | 'create' | 'classify'
  const [activeTab, setActiveTab] = useState<'suggestions' | 'search' | 'create' | 'classify'>('suggestions')

  // נתונים להתאמה
  const [incomeList, setIncomeList] = useState<Income[]>([])
  const [expenseList, setExpenseList] = useState<Expense[]>([])
  
  // נתונים ליצירה
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  
  // טופס יצירת הוצאה/הכנסה חדשה
  const [createForm, setCreateForm] = useState({
    category_id: '',
    supplier_id: '',
    customer_id: '',
    new_customer_name: '', // שם לקוח חדש
    new_supplier_name: '', // שם ספק חדש
    description: '',
    invoice_number: '',
    payment_status: 'paid' as 'pending' | 'partial' | 'paid',
  })
  
  // סיווג תנועות מיוחדות
  const transactionTypes = [
    { value: 'salary', label: '💰 משכורת', icon: Users },
    { value: 'vat_payment', label: '📋 תשלום מע״מ', icon: FileText },
    { value: 'tax_payment', label: '📋 מקדמת מס הכנסה', icon: FileText },
    { value: 'social_security', label: '🏛️ ביטוח לאומי', icon: Building2 },
    { value: 'loan_payment', label: '🏦 החזר הלוואה', icon: Banknote },
    { value: 'owner_withdrawal', label: '👤 משיכת בעלים', icon: Users },
    { value: 'owner_deposit', label: '👤 הפקדת בעלים', icon: Users },
    { value: 'internal_transfer', label: '🔄 העברה פנימית', icon: ArrowLeftRight },
    { value: 'credit_card', label: '💳 סליקת אשראי', icon: CreditCard },
    { value: 'bank_fee', label: '🏦 עמלת בנק', icon: Building2 },
    { value: 'other', label: '📁 אחר', icon: FileText },
  ]

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users')
        .select('company_id')
        .eq('id', user.id)
        .single()

      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      // טעינת תנועות בנק לא מותאמות ולא מסווגות
      const { data: bankData } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('company_id', profile.company_id)
        .is('matched_id', null)
        .or('transaction_type.is.null,transaction_type.eq.regular')
        .order('date', { ascending: false })

      // ספירת מותאמות
      const { count } = await supabase
        .from('bank_transactions')
        .select('id', { count: 'exact' })
        .eq('company_id', profile.company_id)
        .not('matched_id', 'is', null)

      setMatchedCount(count || 0)

      // טעינת הכנסות לא משויכות
      const { data: incomeData } = await supabase
        .from('income')
        .select('*, customer:customers(name)')
        .eq('company_id', profile.company_id)
        .order('date', { ascending: false })

      // טעינת הוצאות לא משויכות  
      const { data: expenseData } = await supabase
        .from('expenses')
        .select('*, supplier:suppliers(name)')
        .eq('company_id', profile.company_id)
        .order('date', { ascending: false })

      setIncomeList(incomeData || [])
      setExpenseList(expenseData || [])
      
      // טעינת קטגוריות, ספקים ולקוחות
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('name')
      
      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('name')
      
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('name')
      
      setCategories(categoriesData || [])
      setSuppliers(suppliersData || [])
      setCustomers(customersData || [])

      // חישוב הצעות התאמה לכל תנועה
      const transactionsWithSuggestions = (bankData || []).map(transaction => ({
        ...transaction,
        suggestions: calculateSuggestions(
          transaction, 
          incomeData || [], 
          expenseData || []
        )
      }))

      setUnmatchedTransactions(transactionsWithSuggestions)

    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // זיהוי תנועות מחברות אשראי
  const isCreditCardCompany = (description: string): boolean => {
    const creditCompanies = [
      'ישראכרט', 'isracard', 'כאל', 'cal', 'מקס', 'max', 
      'לאומי קארד', 'leumi card', 'אמריקן אקספרס', 'american express',
      'דיינרס', 'diners', 'ויזה', 'visa', 'מסטרקארד', 'mastercard'
    ]
    const descLower = description.toLowerCase()
    return creditCompanies.some(company => descLower.includes(company))
  }

  // חישוב הצעות התאמה
  const calculateSuggestions = (
    transaction: BankTransaction,
    incomeList: Income[],
    expenseList: Expense[]
  ): MatchSuggestion[] => {
    const suggestions: MatchSuggestion[] = []
    const isCredit = transaction.amount > 0 // זיכוי = הכנסה
    const absAmount = Math.abs(transaction.amount)
    const transactionDate = new Date(transaction.date)
    const isCreditCardTrans = isCreditCardCompany(transaction.description || '')

    if (isCredit) {
      // חיפוש בהכנסות
      incomeList.forEach(income => {
        // בונוס אם זו תנועת אשראי וההכנסה סומנה כאשראי
        const paymentMethodBonus = 
          isCreditCardTrans && (income as any).payment_method === 'credit_card' ? 15 : 0

        const score = calculateMatchScore(
          absAmount,
          income.amount,
          transactionDate,
          new Date(income.date),
          transaction.description || '',
          (income.customer as any)?.name || income.description || ''
        ) + paymentMethodBonus

        if (score >= 30) {
          const reasons = getMatchReasons(
            absAmount,
            income.amount,
            transactionDate,
            new Date(income.date),
            transaction.description || '',
            (income.customer as any)?.name || ''
          )
          
          if (paymentMethodBonus > 0) {
            reasons.push('אמצעי תשלום תואם (אשראי)')
          }

          suggestions.push({
            type: 'income',
            item: income,
            score: Math.min(score, 100),
            reasons
          })
        }
      })
    } else {
      // חיפוש בהוצאות
      expenseList.forEach(expense => {
        // בונוס אם אמצעי התשלום תואם
        const paymentMethodBonus = 
          isCreditCardTrans && (expense as any).payment_method === 'credit_card' ? 15 : 0

        const score = calculateMatchScore(
          absAmount,
          expense.amount,
          transactionDate,
          new Date(expense.date),
          transaction.description || '',
          (expense.supplier as any)?.name || expense.description || ''
        ) + paymentMethodBonus

        if (score >= 30) {
          const reasons = getMatchReasons(
            absAmount,
            expense.amount,
            transactionDate,
            new Date(expense.date),
            transaction.description || '',
            (expense.supplier as any)?.name || ''
          )

          if (paymentMethodBonus > 0) {
            reasons.push('אמצעי תשלום תואם (אשראי)')
          }

          suggestions.push({
            type: 'expense',
            item: expense,
            score: Math.min(score, 100),
            reasons
          })
        }
      })
    }

    // מיון לפי ציון
    return suggestions.sort((a, b) => b.score - a.score).slice(0, 5)
  }

  // ניקוי שם - הסרת תוארים וסימנים
  const cleanName = (name: string): string => {
    return name
      .replace(/ד["״']?ר\.?/gi, '')
      .replace(/עו["״']?ד\.?/gi, '')
      .replace(/רו["״']?ח\.?/gi, '')
      .replace(/פרופ['׳]?\.?/gi, '')
      .replace(/מר\.?/gi, '')
      .replace(/גב['׳]?\.?/gi, '')
      .replace(/בע["״']?מ\.?/gi, '')
      .replace(/מ\.?מ\.?/gi, '')
      .replace(/[.,\-_'"״׳]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
  }

  // חישוב דמיון בין שני מחרוזות
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = cleanName(str1)
    const s2 = cleanName(str2)
    
    if (!s1 || !s2) return 0
    if (s1 === s2) return 100
    
    // בדיקה אם אחד מכיל את השני
    if (s1.includes(s2) || s2.includes(s1)) return 80
    
    // פיצול למילים
    const words1 = s1.split(/\s+/).filter(w => w.length > 1)
    const words2 = s2.split(/\s+/).filter(w => w.length > 1)
    
    if (words1.length === 0 || words2.length === 0) return 0
    
    // ספירת מילים תואמות
    let matchCount = 0
    for (const w1 of words1) {
      for (const w2 of words2) {
        if (w1 === w2 || w1.includes(w2) || w2.includes(w1)) {
          matchCount++
          break
        }
      }
    }
    
    const matchPercent = (matchCount / Math.min(words1.length, words2.length)) * 100
    return Math.min(matchPercent, 100)
  }

  // חישוב ציון התאמה
  const calculateMatchScore = (
    bankAmount: number,
    recordAmount: number,
    bankDate: Date,
    recordDate: Date,
    bankDesc: string,
    recordName: string
  ): number => {
    let score = 0

    // התאמת סכום (עד 50 נקודות)
    const amountDiff = Math.abs(bankAmount - recordAmount)
    const amountPercent = (amountDiff / bankAmount) * 100
    if (amountDiff === 0) {
      score += 50
    } else if (amountDiff < 1) {
      score += 48 // הפרש של אגורות
    } else if (amountPercent <= 1) {
      score += 45
    } else if (amountPercent <= 3) {
      score += 40 // עמלת סליקה
    } else if (amountPercent <= 5) {
      score += 35
    } else if (amountPercent <= 10) {
      score += 20
    }

    // התאמת תאריך (עד 30 נקודות)
    const daysDiff = Math.abs(
      (bankDate.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysDiff === 0) {
      score += 30
    } else if (daysDiff <= 3) {
      score += 25
    } else if (daysDiff <= 7) {
      score += 20
    } else if (daysDiff <= 14) {
      score += 15
    } else if (daysDiff <= 30) {
      score += 10
    } else if (daysDiff <= 60) {
      score += 5
    }

    // התאמת שם/תיאור (עד 30 נקודות) - משופר!
    const similarity = calculateSimilarity(bankDesc, recordName)
    if (similarity >= 80) {
      score += 30
    } else if (similarity >= 60) {
      score += 25
    } else if (similarity >= 40) {
      score += 20
    } else if (similarity >= 20) {
      score += 10
    }

    return Math.min(score, 100)
  }

  // סיבות להתאמה
  const getMatchReasons = (
    bankAmount: number,
    recordAmount: number,
    bankDate: Date,
    recordDate: Date,
    bankDesc: string,
    recordName: string
  ): string[] => {
    const reasons: string[] = []
    
    const amountDiff = Math.abs(bankAmount - recordAmount)
    if (amountDiff === 0) {
      reasons.push('סכום זהה')
    } else if ((amountDiff / bankAmount) * 100 <= 5) {
      reasons.push('סכום קרוב')
    }

    const daysDiff = Math.abs(
      (bankDate.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    if (daysDiff === 0) {
      reasons.push('תאריך זהה')
    } else if (daysDiff <= 7) {
      reasons.push(`הפרש ${Math.round(daysDiff)} ימים`)
    }

    if (recordName && bankDesc) {
      const similarity = calculateSimilarity(bankDesc, recordName)
      if (similarity >= 80) {
        reasons.push('שם זהה')
      } else if (similarity >= 40) {
        reasons.push('שם דומה')
      }
    }

    return reasons
  }

  // אישור התאמה
  const handleApproveMatch = async (transaction: BankTransaction, suggestion: MatchSuggestion) => {
    if (!companyId) return
    setProcessing(true)

    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({
          matched_type: suggestion.type,
          matched_id: suggestion.item.id
        })
        .eq('id', transaction.id)

      if (error) throw error

      setSuccessMessage('ההתאמה נשמרה בהצלחה!')
      setShowMatchModal(false)
      setSelectedTransaction(null)
      setManualSearch('')
      setShowAllItems(false)
      loadData()

      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error('Error saving match:', error)
    } finally {
      setProcessing(false)
    }
  }

  // התאמה ידנית
  const handleManualMatch = async (transaction: BankTransaction, item: Income | Expense, type: 'income' | 'expense') => {
    if (!companyId) return
    setProcessing(true)

    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({
          matched_type: type,
          matched_id: item.id
        })
        .eq('id', transaction.id)

      if (error) throw error

      setSuccessMessage('ההתאמה נשמרה בהצלחה!')
      setShowMatchModal(false)
      setSelectedTransaction(null)
      setManualSearch('')
      setShowAllItems(false)
      loadData()

      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error('Error saving match:', error)
    } finally {
      setProcessing(false)
    }
  }

  // דחיית כל ההצעות (סימון כ"נבדק")
  const handleDismiss = async (transactionId: string) => {
    // כרגע פשוט נסיר מהרשימה המקומית
    // בעתיד אפשר להוסיף שדה "dismissed" בטבלה
    setUnmatchedTransactions(prev => 
      prev.filter(t => t.id !== transactionId)
    )
  }

  // יצירת הוצאה/הכנסה חדשה מתנועת בנק
  // יצירת הוצאה/הכנסה חדשה מתנועת בנק
  const handleCreateFromTransaction = async (transaction: BankTransaction) => {
    if (!companyId) return
    setProcessing(true)

    try {
      const isCredit = transaction.amount > 0
      const absAmount = Math.abs(transaction.amount)
      
      if (isCredit) {
        // בדיקה אם צריך ליצור לקוח חדש
        let customerId = createForm.customer_id || null
        
        if (!customerId && createForm.new_customer_name.trim()) {
          // יצירת לקוח חדש
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              company_id: companyId,
              name: createForm.new_customer_name.trim(),
              is_active: true,
            })
            .select()
            .single()
          
          if (customerError) throw customerError
          customerId = newCustomer.id
          
          // עדכון רשימת הלקוחות
          setCustomers(prev => [...prev, newCustomer])
        }
        
        // יצירת הכנסה
        const { data: newIncome, error } = await supabase
          .from('income')
          .insert({
            company_id: companyId,
            amount: absAmount,
            date: transaction.date,
            description: createForm.description || transaction.description,
            category_id: createForm.category_id || null,
            customer_id: customerId,
            invoice_number: createForm.invoice_number || null,
            payment_status: createForm.payment_status,
            bank_transaction_id: transaction.id,
            document_type: 'receipt',
            document_status: 'open',
            vat_exempt: false,
          })
          .select()
          .single()

        if (error) throw error

        // עדכון תנועת הבנק
        await supabase
          .from('bank_transactions')
          .update({
            matched_type: 'income',
            matched_id: newIncome.id,
          })
          .eq('id', transaction.id)
          
        setSuccessMessage(customerId && createForm.new_customer_name.trim() 
          ? `הכנסה נוצרה + לקוח חדש "${createForm.new_customer_name}"!`
          : 'הכנסה חדשה נוצרה והותאמה!')
      } else {
        // בדיקה אם צריך ליצור ספק חדש
        let supplierId = createForm.supplier_id || null
        
        if (!supplierId && createForm.new_supplier_name.trim()) {
          // יצירת ספק חדש
          const { data: newSupplier, error: supplierError } = await supabase
            .from('suppliers')
            .insert({
              company_id: companyId,
              name: createForm.new_supplier_name.trim(),
              is_active: true,
            })
            .select()
            .single()
          
          if (supplierError) throw supplierError
          supplierId = newSupplier.id
          
          // עדכון רשימת הספקים
          setSuppliers(prev => [...prev, newSupplier])
        }
        
        // יצירת הוצאה
        const { data: newExpense, error } = await supabase
          .from('expenses')
          .insert({
            company_id: companyId,
            amount: absAmount,
            date: transaction.date,
            description: createForm.description || transaction.description,
            category_id: createForm.category_id || null,
            supplier_id: supplierId,
            invoice_number: createForm.invoice_number || null,
            payment_status: createForm.payment_status,
            bank_transaction_id: transaction.id,
            document_type: 'invoice',
          })
          .select()
          .single()

        if (error) throw error

        // עדכון תנועת הבנק
        await supabase
          .from('bank_transactions')
          .update({
            matched_type: 'expense',
            matched_id: newExpense.id,
          })
          .eq('id', transaction.id)
          
        setSuccessMessage(supplierId && createForm.new_supplier_name.trim()
          ? `הוצאה נוצרה + ספק חדש "${createForm.new_supplier_name}"!`
          : 'הוצאה חדשה נוצרה והותאמה!')
      }

      closeModal()
      loadData()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error('Error creating from transaction:', error)
    } finally {
      setProcessing(false)
    }
  }

  // סיווג תנועה כסוג מיוחד (משכורת, מע"מ, וכו')
  const handleClassifyTransaction = async (transaction: BankTransaction, transactionType: string) => {
    if (!companyId) return
    setProcessing(true)

    try {
      const absAmount = Math.abs(transaction.amount)
      const isCredit = transaction.amount > 0
      
      // מציאת או יצירת קטגוריה מתאימה
      let categoryId: string | null = null
      const categoryMap: Record<string, string> = {
        'salary': 'משכורות',
        'vat_payment': 'מע״מ',
        'tax_payment': 'מסים',
        'social_security': 'ביטוח לאומי',
        'loan_payment': 'הלוואות',
        'bank_fee': 'עמלות בנק',
      }
      
      if (categoryMap[transactionType]) {
        // חיפוש קטגוריה קיימת
        const categoryName = categoryMap[transactionType]
        const existingCategory = categories.find(c => 
          c.name.includes(categoryName) || categoryName.includes(c.name)
        )
        
        if (existingCategory) {
          categoryId = existingCategory.id
        } else {
          // יצירת קטגוריה חדשה
          const { data: newCategory } = await supabase
            .from('categories')
            .insert({
              company_id: companyId,
              name: categoryName,
              type: 'expense',
              is_active: true,
            })
            .select()
            .single()
          
          if (newCategory) {
            categoryId = newCategory.id
            setCategories(prev => [...prev, newCategory])
          }
        }
      }
      
      // עדכון סוג התנועה בבנק
      await supabase
        .from('bank_transactions')
        .update({
          transaction_type: transactionType,
        })
        .eq('id', transaction.id)
      
      // אם זו לא העברה פנימית - יוצרים הוצאה/הכנסה
      if (!['internal_transfer', 'owner_withdrawal', 'owner_deposit', 'credit_card'].includes(transactionType)) {
        if (!isCredit) {
          // יצירת הוצאה
          const { data: newExpense } = await supabase
            .from('expenses')
            .insert({
              company_id: companyId,
              amount: absAmount,
              date: transaction.date,
              description: `${transactionTypes.find(t => t.value === transactionType)?.label || transactionType} - ${transaction.description || ''}`,
              category_id: categoryId,
              payment_status: 'paid',
              bank_transaction_id: transaction.id,
              document_type: 'other',
            })
            .select()
            .single()

          if (newExpense) {
            await supabase
              .from('bank_transactions')
              .update({
                matched_type: 'expense',
                matched_id: newExpense.id,
              })
              .eq('id', transaction.id)
          }
        }
      }

      setSuccessMessage(`התנועה סווגה כ"${transactionTypes.find(t => t.value === transactionType)?.label}"`)
      closeModal()
      loadData()
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (error) {
      console.error('Error classifying transaction:', error)
    } finally {
      setProcessing(false)
    }
  }

  // סגירת מודאל ואיפוס
  const closeModal = () => {
    setShowMatchModal(false)
    setSelectedTransaction(null)
    setManualSearch('')
    setShowAllItems(false)
    setActiveTab('suggestions')
    setCreateForm({
      category_id: '',
      supplier_id: '',
      customer_id: '',
      new_customer_name: '',
      new_supplier_name: '',
      description: '',
      invoice_number: '',
      payment_status: 'paid',
    })
  }

  // פתיחת מודאל התאמה - עם מילוי אוטומטי של שם לקוח/ספק מתיאור התנועה
  const openMatchModal = (transaction: UnmatchedTransaction) => {
    setSelectedTransaction(transaction)
    setShowMatchModal(true)
    
    // ניסיון לחלץ שם מתיאור התנועה
    const desc = transaction.description || ''
    const isCredit = transaction.amount > 0
    
    // מילוי מקדים של שם לקוח/ספק חדש מתיאור התנועה
    if (isCredit) {
      setCreateForm(prev => ({ ...prev, new_customer_name: desc }))
    } else {
      setCreateForm(prev => ({ ...prev, new_supplier_name: desc }))
    }
  }

  // ציון התאמה בצבעים
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success-600 bg-success-50'
    if (score >= 60) return 'text-primary-600 bg-primary-50'
    if (score >= 30) return 'text-warning-600 bg-warning-50'
    return 'text-gray-600 bg-gray-50'
  }

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
        title="התאמת תנועות"
        description="שיוך תנועות בנק להכנסות והוצאות"
        actions={
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="w-4 h-4" />
            רענון
          </Button>
        }
      />

      {successMessage && (
        <Alert variant="success" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* סטטיסטיקות */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-success-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">תנועות מותאמות</p>
              <p className="text-xl font-bold text-success-600">{matchedCount}</p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-warning-50 rounded-lg">
              <AlertCircle className="w-5 h-5 text-warning-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">ממתינות להתאמה</p>
              <p className="text-xl font-bold text-warning-600">{unmatchedTransactions.length}</p>
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-50 rounded-lg">
              <ArrowLeftRight className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">סה״כ תנועות בנק</p>
              <p className="text-xl font-bold text-primary-600">{matchedCount + unmatchedTransactions.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* רשימת תנועות לא מותאמות */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            תנועות בנק ממתינות להתאמה
          </CardTitle>
        </CardHeader>

        {unmatchedTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 text-success-500 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-900">מעולה! כל התנועות מותאמות</p>
            <p className="text-gray-500 mt-1">אין תנועות בנק שממתינות לשיוך</p>
          </div>
        ) : (
          <div className="divide-y">
            {unmatchedTransactions.map(transaction => (
              <div key={transaction.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  {/* פרטי התנועה */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={cn(
                        'p-1.5 rounded-lg',
                        transaction.amount >= 0 ? 'bg-success-50' : 'bg-danger-50'
                      )}>
                        {transaction.amount >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-success-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-danger-600" />
                        )}
                      </div>
                      <span className={cn(
                        'text-lg font-bold',
                        transaction.amount >= 0 ? 'text-success-600' : 'text-danger-600'
                      )}>
                        {transaction.amount >= 0 ? '+' : ''}{formatCurrency(transaction.amount)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {formatDateShort(transaction.date)}
                      </span>
                    </div>
                    <p className="text-gray-700">{transaction.description || 'ללא תיאור'}</p>
                    {transaction.bank_name && (
                      <p className="text-xs text-gray-400 mt-1">{transaction.bank_name}</p>
                    )}
                  </div>

                  {/* הצעות התאמה */}
                  <div className="flex-1">
                    {transaction.suggestions && transaction.suggestions.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs text-gray-500 font-medium">הצעות התאמה:</p>
                        {transaction.suggestions.slice(0, 2).map((suggestion, idx) => (
                          <div 
                            key={idx}
                            className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'px-2 py-0.5 rounded text-xs font-medium',
                                getScoreColor(suggestion.score)
                              )}>
                                {suggestion.score}%
                              </span>
                              <span className="text-gray-700">
                                {suggestion.type === 'income' 
                                  ? (suggestion.item as Income).description || 'הכנסה'
                                  : (suggestion.item as Expense).description || 'הוצאה'
                                }
                              </span>
                            </div>
                            <span className="text-gray-500">
                              {formatCurrency(suggestion.item.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">לא נמצאו התאמות אוטומטיות</p>
                    )}
                  </div>

                  {/* כפתורי פעולה */}
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      onClick={() => openMatchModal(transaction)}
                    >
                      <Search className="w-4 h-4" />
                      התאם
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleDismiss(transaction.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* מודאל התאמה */}
      <Modal
        isOpen={showMatchModal}
        onClose={closeModal}
        title="התאמת תנועה"
        size="xl"
      >
        {selectedTransaction && (
          <div className="space-y-4">
            {/* פרטי תנועת הבנק */}
            <div className={cn(
              "p-4 rounded-lg border",
              selectedTransaction.amount >= 0 
                ? "bg-green-50 border-green-200" 
                : "bg-red-50 border-red-200"
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    selectedTransaction.amount >= 0 ? "bg-green-100" : "bg-red-100"
                  )}>
                    {selectedTransaction.amount >= 0 
                      ? <TrendingUp className="w-5 h-5 text-green-600" />
                      : <TrendingDown className="w-5 h-5 text-red-600" />
                    }
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{selectedTransaction.description || 'ללא תיאור'}</p>
                    <p className="text-sm text-gray-500">{formatDateShort(selectedTransaction.date)}</p>
                  </div>
                </div>
                <span className={cn(
                  'text-2xl font-bold',
                  selectedTransaction.amount >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                  {formatCurrency(selectedTransaction.amount)}
                </span>
              </div>
            </div>

            {/* 4 טאבים */}
            <div className="flex gap-1 border-b overflow-x-auto">
              <button
                onClick={() => setActiveTab('suggestions')}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap',
                  activeTab === 'suggestions' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                🎯 הצעות ({selectedTransaction.suggestions?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('search')}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap',
                  activeTab === 'search' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                🔍 חיפוש
              </button>
              <button
                onClick={() => setActiveTab('create')}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap',
                  activeTab === 'create' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                ➕ יצירת {selectedTransaction.amount >= 0 ? 'הכנסה' : 'הוצאה'}
              </button>
              <button
                onClick={() => setActiveTab('classify')}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 -mb-px whitespace-nowrap',
                  activeTab === 'classify' ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                )}
              >
                🏷️ סיווג מיוחד
              </button>
            </div>

            {/* תוכן הטאבים */}
            <div className="min-h-[300px]">
              {/* טאב הצעות אוטומטיות */}
              {activeTab === 'suggestions' && (
                <div>
                  {selectedTransaction.suggestions && selectedTransaction.suggestions.length > 0 ? (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {selectedTransaction.suggestions.map((suggestion, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={cn(
                                'px-2 py-0.5 rounded text-xs font-bold',
                                getScoreColor(suggestion.score)
                              )}>
                                {suggestion.score}% התאמה
                              </span>
                              {suggestion.reasons.map((reason, i) => (
                                <Badge key={i} variant="default" className="text-xs">
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                            <p className="font-medium text-gray-900">
                              {suggestion.type === 'income'
                                ? (suggestion.item as Income).description || (suggestion.item as any).customer?.name || 'הכנסה'
                                : (suggestion.item as Expense).description || (suggestion.item as any).supplier?.name || 'הוצאה'
                              }
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatDateShort(suggestion.item.date)} • {formatCurrency(suggestion.item.amount)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleApproveMatch(selectedTransaction, suggestion)}
                            loading={processing}
                          >
                            <Check className="w-4 h-4" />
                            אשר
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 mb-4">לא נמצאו התאמות אוטומטיות</p>
                      <div className="flex justify-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => setActiveTab('search')}>
                          <Search className="w-4 h-4" />
                          חפש ידנית
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setActiveTab('create')}>
                          <Plus className="w-4 h-4" />
                          צור חדש
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* טאב חיפוש ידני */}
              {activeTab === 'search' && (
                <div className="space-y-3">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder={`חפש ${selectedTransaction.amount >= 0 ? 'הכנסה' : 'הוצאה'} לפי שם, מספר חשבונית או סכום...`}
                      value={manualSearch}
                      onChange={(e) => setManualSearch(e.target.value)}
                      className="w-full pr-10 pl-4 py-2 border rounded-lg text-sm"
                    />
                  </div>
                  
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {(selectedTransaction.amount >= 0 ? incomeList : expenseList)
                      .filter(item => {
                        if (!manualSearch) return true
                        const search = manualSearch.toLowerCase()
                        const name = selectedTransaction.amount >= 0 
                          ? ((item as any).customer?.name || (item as Income).description || '')
                          : ((item as any).supplier?.name || (item as Expense).description || '')
                        return (
                          name.toLowerCase().includes(search) ||
                          item.invoice_number?.toLowerCase().includes(search) ||
                          item.amount.toString().includes(search)
                        )
                      })
                      .slice(0, 30)
                      .map((item, idx) => (
                        <div 
                          key={idx}
                          className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {selectedTransaction.amount >= 0
                                ? ((item as any).customer?.name || (item as Income).description || 'הכנסה')
                                : ((item as any).supplier?.name || (item as Expense).description || 'הוצאה')
                              }
                            </p>
                            <p className="text-sm text-gray-500">
                              {formatDateShort(item.date)} • {formatCurrency(item.amount)}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleManualMatch(selectedTransaction, item, selectedTransaction.amount >= 0 ? 'income' : 'expense')}
                            loading={processing}
                          >
                            <Check className="w-4 h-4" />
                            התאם
                          </Button>
                        </div>
                      ))}
                    {(selectedTransaction.amount >= 0 ? incomeList : expenseList).length === 0 && (
                      <p className="text-center text-gray-500 py-4">
                        אין {selectedTransaction.amount >= 0 ? 'הכנסות' : 'הוצאות'} במערכת
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* טאב יצירת הכנסה/הוצאה חדשה */}
              {activeTab === 'create' && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm text-blue-700">
                      <strong>💡 טיפ:</strong> צור {selectedTransaction.amount >= 0 ? 'הכנסה' : 'הוצאה'} חדשה מתנועת הבנק. 
                      הסכום ({formatCurrency(Math.abs(selectedTransaction.amount))}) והתאריך יועתקו אוטומטית.
                    </p>
                  </div>
                  
                  <Input
                    label="תיאור"
                    value={createForm.description}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={selectedTransaction.description || 'תיאור...'}
                  />
                  
                  <Select
                    label="קטגוריה"
                    value={createForm.category_id}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, category_id: e.target.value }))}
                    options={[
                      { value: '', label: 'בחר קטגוריה' },
                      ...categories
                        .filter(c => selectedTransaction.amount >= 0 ? c.type === 'income' : c.type === 'expense')
                        .map(c => ({ value: c.id, label: c.name }))
                    ]}
                  />
                  
                  {/* לקוח/ספק - בחירה קיימת או יצירת חדש */}
                  {selectedTransaction.amount >= 0 ? (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">לקוח</label>
                      <Select
                        value={createForm.customer_id}
                        onChange={(e) => {
                          setCreateForm(prev => ({ 
                            ...prev, 
                            customer_id: e.target.value,
                            new_customer_name: e.target.value ? '' : prev.new_customer_name // אם בחרו קיים, מנקים את החדש
                          }))
                        }}
                        options={[
                          { value: '', label: '-- בחר לקוח קיים או צור חדש למטה --' },
                          ...customers.map(c => ({ value: c.id, label: c.name }))
                        ]}
                      />
                      {!createForm.customer_id && (
                        <div className="relative">
                          <Input
                            label=""
                            value={createForm.new_customer_name}
                            onChange={(e) => setCreateForm(prev => ({ ...prev, new_customer_name: e.target.value }))}
                            placeholder="או הקלד שם לקוח חדש..."
                            className="pr-8"
                          />
                          {createForm.new_customer_name && (
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 text-xs font-medium bg-green-100 px-2 py-0.5 rounded">
                              + חדש
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-700">ספק</label>
                      <Select
                        value={createForm.supplier_id}
                        onChange={(e) => {
                          setCreateForm(prev => ({ 
                            ...prev, 
                            supplier_id: e.target.value,
                            new_supplier_name: e.target.value ? '' : prev.new_supplier_name
                          }))
                        }}
                        options={[
                          { value: '', label: '-- בחר ספק קיים או צור חדש למטה --' },
                          ...suppliers.map(s => ({ value: s.id, label: s.name }))
                        ]}
                      />
                      {!createForm.supplier_id && (
                        <div className="relative">
                          <Input
                            label=""
                            value={createForm.new_supplier_name}
                            onChange={(e) => setCreateForm(prev => ({ ...prev, new_supplier_name: e.target.value }))}
                            placeholder="או הקלד שם ספק חדש..."
                            className="pr-8"
                          />
                          {createForm.new_supplier_name && (
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 text-xs font-medium bg-green-100 px-2 py-0.5 rounded">
                              + חדש
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <Input
                    label="מספר חשבונית (אופציונלי)"
                    value={createForm.invoice_number}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, invoice_number: e.target.value }))}
                    placeholder="מספר חשבונית..."
                  />
                  
                  <Button 
                    className="w-full"
                    onClick={() => handleCreateFromTransaction(selectedTransaction)}
                    loading={processing}
                  >
                    <Plus className="w-4 h-4" />
                    צור {selectedTransaction.amount >= 0 ? 'הכנסה' : 'הוצאה'} 
                    {selectedTransaction.amount >= 0 
                      ? (createForm.new_customer_name && !createForm.customer_id ? ' + לקוח חדש' : '')
                      : (createForm.new_supplier_name && !createForm.supplier_id ? ' + ספק חדש' : '')
                    }
                  </Button>
                </div>
              )}

              {/* טאב סיווג מיוחד */}
              {activeTab === 'classify' && (
                <div className="space-y-3">
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-sm text-amber-700">
                      <strong>🏷️ סיווג מיוחד:</strong> לתנועות כמו משכורות, מע"מ, הלוואות, וכו' - 
                      שלא צריכות התאמה לחשבונית ספציפית.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {transactionTypes.map((type) => {
                      const Icon = type.icon
                      return (
                        <button
                          key={type.value}
                          onClick={() => handleClassifyTransaction(selectedTransaction, type.value)}
                          disabled={processing}
                          className="flex items-center gap-3 p-3 border-2 rounded-lg hover:bg-gray-50 hover:border-primary-300 transition-all text-right"
                        >
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <Icon className="w-5 h-5 text-gray-600" />
                          </div>
                          <span className="font-medium text-gray-700">{type.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* כפתור סגירה */}
            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={closeModal}>
                סגור
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
