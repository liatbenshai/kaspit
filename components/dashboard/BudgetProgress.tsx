'use client'

import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { formatCurrency, cn } from '@/lib/utils'
import type { BudgetStatus } from '@/lib/insights'

interface BudgetProgressProps {
  budgets: BudgetStatus[]
}

export function BudgetProgress({ budgets }: BudgetProgressProps) {
  if (budgets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>תקציב מול ביצוע</CardTitle>
        </CardHeader>
        <div className="text-center py-8 text-gray-500">
          לא הוגדרו תקציבים עדיין.
          <br />
          <a href="/budget" className="text-primary-600 hover:underline">
            הגדר תקציב ראשון
          </a>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>תקציב מול ביצוע</CardTitle>
      </CardHeader>
      <div className="space-y-4">
        {budgets.slice(0, 5).map((budget) => (
          <div key={budget.categoryId}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">
                {budget.categoryName}
              </span>
              <span className="text-sm text-gray-500">
                {formatCurrency(budget.actual)} / {formatCurrency(budget.budgeted)}
              </span>
            </div>
            <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'absolute top-0 right-0 h-full rounded-full transition-all',
                  budget.status === 'over'
                    ? 'bg-danger-500'
                    : budget.status === 'near'
                    ? 'bg-warning-500'
                    : 'bg-success-500'
                )}
                style={{ width: `${Math.min(budget.percentage, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1">
              <span
                className={cn(
                  'text-xs font-medium',
                  budget.status === 'over'
                    ? 'text-danger-600'
                    : budget.status === 'near'
                    ? 'text-warning-600'
                    : 'text-success-600'
                )}
              >
                {budget.percentage}%
              </span>
              {budget.status === 'over' && (
                <span className="text-xs text-danger-600">
                  חריגה של {formatCurrency(budget.actual - budget.budgeted)}
                </span>
              )}
            </div>
          </div>
        ))}
        {budgets.length > 5 && (
          <a
            href="/budget"
            className="block text-center text-sm text-primary-600 hover:underline pt-2"
          >
            הצג את כל התקציבים ({budgets.length})
          </a>
        )}
      </div>
    </Card>
  )
}
