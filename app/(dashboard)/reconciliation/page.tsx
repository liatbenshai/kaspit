'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
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
  RefreshCw
} from 'lucide-react'
import type { BankTransaction, Income, Expense } from '@/types'

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

  // נתונים להתאמה
  const [incomeList, setIncomeList] = useState<Income[]>([])
  const [expenseList, setExpenseList] = useState<Expense[]>([])

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

      // טעינת תנועות בנק לא מותאמות
      const { data: bankData } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('company_id', profile.company_id)
        .is('matched_id', null)
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

        if (score >= 40) {
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

        if (score >= 40) {
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
    } else if (amountPercent <= 1) {
      score += 45
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
      score += 15
    } else if (daysDiff <= 14) {
      score += 10
    } else if (daysDiff <= 30) {
      score += 5
    }

    // התאמת שם/תיאור (עד 20 נקודות)
    const bankWords = bankDesc.toLowerCase().split(/\s+/)
    const recordWords = recordName.toLowerCase().split(/\s+/)
    const matchingWords = bankWords.filter(word => 
      word.length > 2 && recordWords.some(rWord => rWord.includes(word) || word.includes(rWord))
    )
    if (matchingWords.length >= 2) {
      score += 20
    } else if (matchingWords.length === 1) {
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
      const bankWords = bankDesc.toLowerCase().split(/\s+/)
      const recordWords = recordName.toLowerCase().split(/\s+/)
      const hasMatch = bankWords.some(word => 
        word.length > 2 && recordWords.some(rWord => rWord.includes(word))
      )
      if (hasMatch) {
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

  // פתיחת מודאל התאמה
  const openMatchModal = (transaction: UnmatchedTransaction) => {
    setSelectedTransaction(transaction)
    setShowMatchModal(true)
  }

  // ציון התאמה בצבעים
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-success-600 bg-success-50'
    if (score >= 60) return 'text-primary-600 bg-primary-50'
    if (score >= 40) return 'text-warning-600 bg-warning-50'
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
        onClose={() => {
          setShowMatchModal(false)
          setSelectedTransaction(null)
        }}
        title="בחירת התאמה"
        size="lg"
      >
        {selectedTransaction && (
          <div className="space-y-4">
            {/* פרטי תנועת הבנק */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-700 font-medium mb-2">תנועת בנק:</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-blue-900">{selectedTransaction.description || 'ללא תיאור'}</p>
                  <p className="text-sm text-blue-600">{formatDateShort(selectedTransaction.date)}</p>
                </div>
                <span className={cn(
                  'text-xl font-bold',
                  selectedTransaction.amount >= 0 ? 'text-success-600' : 'text-danger-600'
                )}>
                  {formatCurrency(selectedTransaction.amount)}
                </span>
              </div>
            </div>

            {/* הצעות התאמה */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-3">
                {selectedTransaction.amount >= 0 ? 'הכנסות מתאימות:' : 'הוצאות מתאימות:'}
              </p>
              
              {selectedTransaction.suggestions && selectedTransaction.suggestions.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
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
                          {suggestion.item.invoice_number && ` • מס׳ ${suggestion.item.invoice_number}`}
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
                <div className="p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-gray-500">לא נמצאו התאמות אוטומטיות</p>
                  <p className="text-sm text-gray-400 mt-1">
                    נסי להוסיף את ה{selectedTransaction.amount >= 0 ? 'הכנסה' : 'הוצאה'} ידנית
                  </p>
                </div>
              )}
            </div>

            {/* כפתורי סגירה */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowMatchModal(false)
                  setSelectedTransaction(null)
                }}
              >
                סגור
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
