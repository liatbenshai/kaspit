'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { supabase } from '@/lib/supabase'
import { formatCurrency, getMonthName, hebrewMonths, cn } from '@/lib/utils'
import { analyzeBudgetStatus, suggestBudget } from '@/lib/insights'
import { Plus, Lightbulb, TrendingUp, AlertTriangle, CheckCircle, Sparkles } from 'lucide-react'
import type { Budget, Category } from '@/types'
import type { BudgetStatus } from '@/lib/insights'

export default function BudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showSuggestModal, setShowSuggestModal] = useState(false)
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [companyId, setCompanyId] = useState<string | null>(null)
  
  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1)

  const [formData, setFormData] = useState({
    category_id: '',
    amount: '',
  })

  useEffect(() => {
    loadData()
  }, [selectedYear, selectedMonth])

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

      // Load budgets for selected period
      const { data: budgetsData } = await supabase
        .from('budgets')
        .select('*, category:categories(*)')
        .eq('company_id', profile.company_id)
        .eq('year', selectedYear)
        .eq('month', selectedMonth)

      setBudgets(budgetsData || [])

      // Load categories
      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('type', 'expense')
        .eq('is_active', true)

      setCategories(categoriesData || [])

      // Get budget status with actual expenses
      const status = await analyzeBudgetStatus(profile.company_id, selectedYear, selectedMonth)
      setBudgetStatus(status)

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
      const budgetData = {
        company_id: companyId,
        category_id: formData.category_id,
        year: selectedYear,
        month: selectedMonth,
        amount: parseFloat(formData.amount),
      }

      // Check if budget already exists
      const existing = budgets.find(b => b.category_id === formData.category_id)
      
      if (existing) {
        await supabase
          .from('budgets')
          .update({ amount: budgetData.amount })
          .eq('id', existing.id)
      } else {
        await supabase.from('budgets').insert(budgetData)
      }

      setShowAddModal(false)
      setFormData({ category_id: '', amount: '' })
      loadData()
    } catch (error) {
      console.error('Error saving budget:', error)
    }
  }

  const handleGetSuggestions = async () => {
    if (!companyId) return
    
    const suggestionsData = await suggestBudget(companyId, selectedYear, selectedMonth)
    setSuggestions(suggestionsData)
    setShowSuggestModal(true)
  }

  const handleApplySuggestion = async (suggestion: any) => {
    if (!companyId) return

    const existing = budgets.find(b => b.category_id === suggestion.categoryId)
    
    if (existing) {
      await supabase
        .from('budgets')
        .update({ amount: suggestion.suggestedAmount })
        .eq('id', existing.id)
    } else {
      await supabase.from('budgets').insert({
        company_id: companyId,
        category_id: suggestion.categoryId,
        year: selectedYear,
        month: selectedMonth,
        amount: suggestion.suggestedAmount,
      })
    }

    loadData()
  }

  const handleApplyAllSuggestions = async () => {
    for (const suggestion of suggestions) {
      await handleApplySuggestion(suggestion)
    }
    setShowSuggestModal(false)
  }

  const totalBudgeted = budgetStatus.reduce((sum, b) => sum + b.budgeted, 0)
  const totalActual = budgetStatus.reduce((sum, b) => sum + b.actual, 0)
  const overBudgetCount = budgetStatus.filter(b => b.status === 'over').length
  const nearBudgetCount = budgetStatus.filter(b => b.status === 'near').length

  // Categories without budget
  const categoriesWithoutBudget = categories.filter(
    c => !budgets.find(b => b.category_id === c.id)
  )

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
        title="תקציב"
        description="ניהול תקציב והשוואה לביצוע בפועל"
        actions={
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleGetSuggestions}>
              <Sparkles className="w-4 h-4" />
              הצע תקציב אוטומטי
            </Button>
            <Button onClick={() => setShowAddModal(true)}>
              <Plus className="w-4 h-4" />
              הוספת תקציב
            </Button>
          </div>
        }
      />

      {/* Period Selector */}
      <Card padding="md">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">תקופה:</span>
          <Select
            options={hebrewMonths.map((name, index) => ({
              value: String(index + 1),
              label: name,
            }))}
            value={String(selectedMonth)}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
          />
          <Select
            options={[
              { value: String(currentDate.getFullYear() - 1), label: String(currentDate.getFullYear() - 1) },
              { value: String(currentDate.getFullYear()), label: String(currentDate.getFullYear()) },
              { value: String(currentDate.getFullYear() + 1), label: String(currentDate.getFullYear() + 1) },
            ]}
            value={String(selectedYear)}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
          />
        </div>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card padding="md">
          <p className="text-sm text-gray-500">סה״כ תקציב</p>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalBudgeted)}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-500">סה״כ בפועל</p>
          <p className={cn(
            'text-2xl font-bold',
            totalActual > totalBudgeted ? 'text-danger-600' : 'text-success-600'
          )}>
            {formatCurrency(totalActual)}
          </p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-500">חריגות</p>
          <p className="text-2xl font-bold text-danger-600">{overBudgetCount}</p>
        </Card>
        <Card padding="md">
          <p className="text-sm text-gray-500">קרוב לחריגה</p>
          <p className="text-2xl font-bold text-warning-600">{nearBudgetCount}</p>
        </Card>
      </div>

      {/* Warnings */}
      {categoriesWithoutBudget.length > 0 && (
        <Alert variant="info">
          <div className="flex items-center justify-between">
            <span>יש {categoriesWithoutBudget.length} קטגוריות ללא תקציב מוגדר</span>
            <Button size="sm" variant="ghost" onClick={handleGetSuggestions}>
              הצע תקציב
            </Button>
          </div>
        </Alert>
      )}

      {/* Budget List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {budgetStatus.length === 0 ? (
          <Card padding="lg" className="col-span-2">
            <div className="text-center py-8">
              <Lightbulb className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                אין תקציב מוגדר לתקופה זו
              </h3>
              <p className="text-gray-500 mb-4">
                הגדר תקציב ידנית או תן למערכת להציע תקציב על בסיס ההיסטוריה שלך
              </p>
              <div className="flex justify-center gap-3">
                <Button onClick={() => setShowAddModal(true)}>
                  <Plus className="w-4 h-4" />
                  הוסף ידנית
                </Button>
                <Button variant="outline" onClick={handleGetSuggestions}>
                  <Sparkles className="w-4 h-4" />
                  הצע אוטומטית
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          budgetStatus.map((budget) => (
            <Card key={budget.categoryId} padding="md">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-gray-900">{budget.categoryName}</h3>
                  <p className="text-sm text-gray-500">
                    {formatCurrency(budget.actual)} / {formatCurrency(budget.budgeted)}
                  </p>
                </div>
                <div className={cn(
                  'p-2 rounded-lg',
                  budget.status === 'over' ? 'bg-danger-50' :
                  budget.status === 'near' ? 'bg-warning-50' : 'bg-success-50'
                )}>
                  {budget.status === 'over' ? (
                    <AlertTriangle className="w-5 h-5 text-danger-600" />
                  ) : budget.status === 'near' ? (
                    <TrendingUp className="w-5 h-5 text-warning-600" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-success-600" />
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
                <div
                  className={cn(
                    'absolute top-0 right-0 h-full rounded-full transition-all',
                    budget.status === 'over' ? 'bg-danger-500' :
                    budget.status === 'near' ? 'bg-warning-500' : 'bg-success-500'
                  )}
                  style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between">
                <span className={cn(
                  'text-sm font-medium',
                  budget.status === 'over' ? 'text-danger-600' :
                  budget.status === 'near' ? 'text-warning-600' : 'text-success-600'
                )}>
                  {budget.percentage}%
                </span>
                {budget.status === 'over' && (
                  <span className="text-sm text-danger-600">
                    חריגה: {formatCurrency(budget.actual - budget.budgeted)}
                  </span>
                )}
                {budget.status === 'under' && budget.budgeted > budget.actual && (
                  <span className="text-sm text-success-600">
                    נותר: {formatCurrency(budget.budgeted - budget.actual)}
                  </span>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add Budget Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setFormData({ category_id: '', amount: '' })
        }}
        title="הוספת תקציב"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
            תקציב ל{getMonthName(selectedMonth)} {selectedYear}
          </div>

          <Select
            label="קטגוריה"
            options={[
              { value: '', label: 'בחר קטגוריה' },
              ...categories.map(c => ({ value: c.id, label: c.name }))
            ]}
            value={formData.category_id}
            onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
            required
          />

          <Input
            label="סכום תקציב"
            type="number"
            step="100"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
          />

          <div className="flex gap-3 pt-4">
            <Button type="submit">שמור</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowAddModal(false)
                setFormData({ category_id: '', amount: '' })
              }}
            >
              ביטול
            </Button>
          </div>
        </form>
      </Modal>

      {/* Suggestions Modal */}
      <Modal
        isOpen={showSuggestModal}
        onClose={() => setShowSuggestModal(false)}
        title="הצעת תקציב אוטומטית"
        size="lg"
      >
        <div className="space-y-4">
          <Alert variant="info">
            ההצעות מבוססות על ממוצע ההוצאות שלך ב-3 חודשים האחרונים
          </Alert>

          {suggestions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              אין מספיק נתונים היסטוריים ליצירת הצעות
            </p>
          ) : (
            <>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.categoryId}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{suggestion.categoryName}</p>
                      <p className="text-sm text-gray-500">{suggestion.reason}</p>
                      <p className="text-xs text-gray-400">
                        ממוצע: {formatCurrency(suggestion.avgAmount)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-primary-600">
                        {formatCurrency(suggestion.suggestedAmount)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleApplySuggestion(suggestion)}
                      >
                        החל
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4 border-t">
                <Button onClick={handleApplyAllSuggestions}>
                  החל את כל ההצעות
                </Button>
                <Button variant="outline" onClick={() => setShowSuggestModal(false)}>
                  סגור
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
