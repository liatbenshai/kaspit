'use client'

import { useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { supabase } from '@/lib/supabase'
import { formatCurrency, cn } from '@/lib/utils'
import { 
  CheckCircle, AlertTriangle, ArrowRight, Zap, 
  Building2, Repeat, Send, RefreshCw, TrendingUp, TrendingDown,
  Link2, FileText, Check
} from 'lucide-react'
import Link from 'next/link'

interface ActionCenterProps {
  companyId: string
}

interface ActionItem {
  id: string
  type: 'bank_match' | 'recurring' | 'overdue' | 'unclassified'
  title: string
  description: string
  count: number
  amount?: number
  severity: 'info' | 'warning' | 'danger'
  link: string
  action?: () => Promise<void>
  actionLabel?: string
}

export function ActionCenter({ companyId }: ActionCenterProps) {
  const [loading, setLoading] = useState(true)
  const [actions, setActions] = useState<ActionItem[]>([])
  const [processing, setProcessing] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [autoMatchResults, setAutoMatchResults] = useState<{matched: number, created: number} | null>(null)

  useEffect(() => {
    if (companyId) loadActions()
  }, [companyId])

  const loadActions = async () => {
    try {
      setLoading(true)
      const items: ActionItem[] = []

      // 1. תנועות בנק לא מותאמות
      const { data: unmatchedBank, count: unmatchedCount } = await supabase
        .from('bank_transactions')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .is('matched_id', null)
        .or('transaction_type.is.null,transaction_type.eq.regular')

      if (unmatchedCount && unmatchedCount > 0) {
        const totalAmount = unmatchedBank?.reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0
        items.push({
          id: 'bank_match',
          type: 'bank_match',
          title: 'תנועות בנק לא מותאמות',
          description: `${unmatchedCount} תנועות ממתינות לסיווג או התאמה`,
          count: unmatchedCount,
          amount: totalAmount,
          severity: unmatchedCount > 20 ? 'danger' : unmatchedCount > 5 ? 'warning' : 'info',
          link: '/reconciliation',
          actionLabel: 'התאמה חכמה',
        })
      }

      // 2. הוצאות חוזרות שלא נוצרו החודש
      const today = new Date()
      const { data: recurringExpenses } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)

      const pendingRecurring = recurringExpenses?.filter(exp => {
        if (!exp.last_generated_date) return true
        const lastGen = new Date(exp.last_generated_date)
        return lastGen.getMonth() !== today.getMonth() || lastGen.getFullYear() !== today.getFullYear()
      }) || []

      if (pendingRecurring.length > 0) {
        const totalAmount = pendingRecurring.reduce((sum, e) => sum + e.amount, 0)
        items.push({
          id: 'recurring',
          type: 'recurring',
          title: 'הוצאות חוזרות לחודש זה',
          description: `${pendingRecurring.length} הוצאות קבועות ממתינות ליצירה`,
          count: pendingRecurring.length,
          amount: totalAmount,
          severity: 'warning',
          link: '/recurring-expenses',
          actionLabel: 'צור הוצאות',
        })
      }

      // 3. חשבוניות באיחור
      const { data: overdueInvoices, count: overdueCount } = await supabase
        .from('income')
        .select('*', { count: 'exact' })
        .eq('company_id', companyId)
        .neq('payment_status', 'paid')
        .in('document_type', ['invoice', 'tax_invoice'])
        .lt('due_date', today.toISOString().split('T')[0])

      if (overdueCount && overdueCount > 0) {
        const totalOverdue = overdueInvoices?.reduce((sum, i) => sum + i.amount, 0) || 0
        items.push({
          id: 'overdue',
          type: 'overdue',
          title: 'חשבוניות באיחור',
          description: `${overdueCount} חשבוניות שעברו מועד התשלום`,
          count: overdueCount,
          amount: totalOverdue,
          severity: 'danger',
          link: '/collection',
          actionLabel: 'גבייה',
        })
      }

      // 4. הוצאות/הכנסות לא משויכות לבנק
      const { count: unmatchedIncomeCount } = await supabase
        .from('income')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('payment_status', 'paid')
        .is('bank_transaction_id', null)

      const { count: unmatchedExpenseCount } = await supabase
        .from('expenses')
        .select('id', { count: 'exact' })
        .eq('company_id', companyId)
        .eq('payment_status', 'paid')
        .is('bank_transaction_id', null)

      const totalUnmatched = (unmatchedIncomeCount || 0) + (unmatchedExpenseCount || 0)
      if (totalUnmatched > 0) {
        items.push({
          id: 'unclassified',
          type: 'unclassified',
          title: 'רשומות לא משויכות לבנק',
          description: `${unmatchedIncomeCount || 0} הכנסות + ${unmatchedExpenseCount || 0} הוצאות`,
          count: totalUnmatched,
          severity: totalUnmatched > 10 ? 'warning' : 'info',
          link: '/reconciliation',
        })
      }

      setActions(items)
    } catch (error) {
      console.error('Error loading actions:', error)
    } finally {
      setLoading(false)
    }
  }

  // התאמה חכמה - לומד מהתאמות קודמות
  const runSmartMatching = async () => {
    setProcessing('smart')
    setAutoMatchResults(null)
    
    try {
      let matchedCount = 0
      let classifiedCount = 0

      // 1. שליפת תנועות לא מותאמות
      const { data: unmatchedTransactions } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('company_id', companyId)
        .is('matched_id', null)
        .or('transaction_type.is.null,transaction_type.eq.regular')

      if (!unmatchedTransactions || unmatchedTransactions.length === 0) {
        setSuccessMessage('אין תנועות לעיבוד')
        setProcessing(null)
        return
      }

      // 2. שליפת כללי התאמה
      const { data: rules } = await supabase
        .from('matching_rules')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)

      // 3. שליפת הכנסות והוצאות לא משויכות
      const { data: incomeList } = await supabase
        .from('income')
        .select('*, customer:customers(name)')
        .eq('company_id', companyId)
        .eq('payment_status', 'paid')
        .is('bank_transaction_id', null)

      const { data: expenseList } = await supabase
        .from('expenses')
        .select('*, supplier:suppliers(name)')
        .eq('company_id', companyId)
        .eq('payment_status', 'paid')
        .is('bank_transaction_id', null)

      // 4. עיבוד כל תנועה
      for (const transaction of unmatchedTransactions) {
        const description = (transaction.description || '').toLowerCase()
        const absAmount = Math.abs(transaction.amount)
        const isCredit = transaction.amount > 0

        // חיפוש כלל התאמה
        const matchingRule = rules?.find(rule => {
          const pattern = rule.pattern.toLowerCase()
          switch (rule.pattern_type) {
            case 'exact': return description === pattern
            case 'starts_with': return description.startsWith(pattern)
            case 'contains': return description.includes(pattern)
            default: return false
          }
        })

        if (matchingRule) {
          // סיווג לפי כלל
          if (matchingRule.target_type === 'ignore') {
            await supabase.from('bank_transactions').update({
              transaction_type: 'other',
              notes: 'סווג אוטומטית - להתעלם',
            }).eq('id', transaction.id)
            classifiedCount++
            continue
          }

          if (matchingRule.target_type === 'transfer') {
            await supabase.from('bank_transactions').update({
              transaction_type: 'transfer_between',
              is_recurring: matchingRule.is_recurring,
              recurring_label: matchingRule.recurring_label,
            }).eq('id', transaction.id)
            classifiedCount++
            continue
          }

          // סיווג כהוצאה/הכנסה מיוחדת
          await supabase.from('bank_transactions').update({
            transaction_type: matchingRule.transaction_type || 'regular',
            is_recurring: matchingRule.is_recurring,
            recurring_label: matchingRule.recurring_label,
          }).eq('id', transaction.id)
          
          // עדכון שימוש בכלל
          await supabase.from('matching_rules').update({
            times_used: (matchingRule.times_used || 0) + 1,
            last_used_at: new Date().toISOString(),
          }).eq('id', matchingRule.id)
          
          classifiedCount++
          continue
        }

        // חיפוש התאמה לפי סכום ותאריך
        const candidates = isCredit ? incomeList : expenseList
        const transactionDate = new Date(transaction.date)

        const match = candidates?.find(item => {
          const itemDate = new Date(item.date)
          const daysDiff = Math.abs((transactionDate.getTime() - itemDate.getTime()) / (1000 * 60 * 60 * 24))
          const amountDiff = Math.abs(item.amount - absAmount)
          const amountMatch = amountDiff < 1 || (amountDiff / absAmount) < 0.01 // סכום זהה או הפרש קטן מ-1%
          
          return amountMatch && daysDiff <= 7
        })

        if (match) {
          // ביצוע התאמה
          await supabase.from('bank_transactions').update({
            matched_id: match.id,
            matched_type: isCredit ? 'income' : 'expense',
          }).eq('id', transaction.id)

          // עדכון ההכנסה/הוצאה
          const table = isCredit ? 'income' : 'expenses'
          await supabase.from(table).update({
            bank_transaction_id: transaction.id,
          }).eq('id', match.id)

          matchedCount++
        }
      }

      setAutoMatchResults({ matched: matchedCount, created: classifiedCount })
      setSuccessMessage(`התאמה חכמה הושלמה: ${matchedCount} התאמות, ${classifiedCount} סיווגים`)
      loadActions()
    } catch (error) {
      console.error('Error in smart matching:', error)
      setSuccessMessage('שגיאה בהתאמה חכמה')
    } finally {
      setProcessing(null)
    }
  }

  // יצירת הוצאות חוזרות
  const generateRecurringExpenses = async () => {
    setProcessing('recurring')
    
    try {
      const today = new Date()
      let generatedCount = 0

      const { data: recurringExpenses } = await supabase
        .from('recurring_expenses')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_active', true)

      for (const item of recurringExpenses || []) {
        // בדיקה אם כבר נוצר החודש
        if (item.last_generated_date) {
          const lastGen = new Date(item.last_generated_date)
          if (lastGen.getMonth() === today.getMonth() && lastGen.getFullYear() === today.getFullYear()) {
            continue
          }
        }

        // יצירת הוצאה
        const expenseDate = new Date(today.getFullYear(), today.getMonth(), item.day_of_month || 1)
        
        await supabase.from('expenses').insert({
          company_id: companyId,
          category_id: item.category_id,
          supplier_id: item.supplier_id,
          amount: item.amount,
          date: expenseDate.toISOString().split('T')[0],
          description: `${item.name} - ${today.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}`,
          payment_status: 'pending',
          recurring_expense_id: item.id,
        })

        await supabase.from('recurring_expenses').update({
          last_generated_date: expenseDate.toISOString().split('T')[0],
        }).eq('id', item.id)

        generatedCount++
      }

      setSuccessMessage(`נוצרו ${generatedCount} הוצאות חדשות!`)
      loadActions()
    } catch (error) {
      console.error('Error generating expenses:', error)
    } finally {
      setProcessing(null)
    }
  }

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case 'danger': return 'border-red-200 bg-red-50'
      case 'warning': return 'border-amber-200 bg-amber-50'
      default: return 'border-blue-200 bg-blue-50'
    }
  }

  const getSeverityIcon = (type: string, severity: string) => {
    const iconClass = severity === 'danger' ? 'text-red-600' : severity === 'warning' ? 'text-amber-600' : 'text-blue-600'
    
    switch (type) {
      case 'bank_match': return <Building2 className={cn('w-5 h-5', iconClass)} />
      case 'recurring': return <Repeat className={cn('w-5 h-5', iconClass)} />
      case 'overdue': return <AlertTriangle className={cn('w-5 h-5', iconClass)} />
      default: return <Link2 className={cn('w-5 h-5', iconClass)} />
    }
  }

  if (loading) {
    return (
      <Card padding="md">
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </Card>
    )
  }

  const hasActions = actions.length > 0

  return (
    <Card padding="none" className="overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-primary-50 to-primary-100 border-b">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-500 rounded-lg">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>מרכז פעולות</CardTitle>
              <p className="text-sm text-gray-500 mt-0.5">
                {hasActions ? `${actions.length} משימות ממתינות` : 'הכל מעודכן!'}
              </p>
            </div>
          </div>
          
          {hasActions && (
            <Button 
              onClick={runSmartMatching} 
              loading={processing === 'smart'}
              disabled={processing !== null}
            >
              <Zap className="w-4 h-4" />
              התאמה חכמה
            </Button>
          )}
        </div>
      </CardHeader>

      {successMessage && (
        <Alert variant="success" className="m-4" onClose={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {autoMatchResults && (
        <div className="mx-4 mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-4">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <div className="flex-1">
              <span className="font-medium text-green-800">תוצאות ההתאמה החכמה:</span>
              <div className="flex gap-4 mt-1 text-sm text-green-700">
                <span>{autoMatchResults.matched} התאמות לחשבוניות</span>
                <span>{autoMatchResults.created} סיווגים אוטומטיים</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4">
        {!hasActions ? (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-gray-900">מעולה! אין משימות ממתינות</p>
            <p className="text-gray-500 mt-1">כל התנועות מותאמות וההוצאות מעודכנות</p>
          </div>
        ) : (
          <div className="space-y-3">
            {actions.map(action => (
              <div 
                key={action.id}
                className={cn(
                  'flex items-center justify-between p-4 rounded-lg border',
                  getSeverityStyles(action.severity)
                )}
              >
                <div className="flex items-center gap-4">
                  {getSeverityIcon(action.type, action.severity)}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{action.title}</span>
                      <Badge variant={action.severity === 'danger' ? 'danger' : action.severity === 'warning' ? 'warning' : 'info'}>
                        {action.count}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{action.description}</p>
                    {action.amount && (
                      <p className="text-sm font-medium text-gray-700 mt-1">
                        סה״כ: {formatCurrency(action.amount)}
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {action.type === 'recurring' && (
                    <Button 
                      size="sm"
                      onClick={generateRecurringExpenses}
                      loading={processing === 'recurring'}
                      disabled={processing !== null}
                    >
                      <Check className="w-4 h-4" />
                      {action.actionLabel}
                    </Button>
                  )}
                  <Link href={action.link}>
                    <Button size="sm" variant="outline">
                      <ArrowRight className="w-4 h-4" />
                      עבור
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* הסבר קצר */}
      <div className="px-4 pb-4">
        <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
          <p className="font-medium text-gray-700 mb-1">💡 טיפ:</p>
          <p>לחצי על "התאמה חכמה" כדי שהמערכת תתאים אוטומטית תנועות בנק להכנסות והוצאות לפי סכום, תאריך וכללים שהגדרת.</p>
        </div>
      </div>
    </Card>
  )
}
