'use client'

import { Card } from '@/components/ui/Card'
import { formatCurrency, calculateChange } from '@/lib/utils'
import { TrendingUp, TrendingDown, Wallet, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsCardsProps {
  totalIncome: number
  totalExpenses: number
  balance: number
  prevIncome?: number
  prevExpenses?: number
}

export function StatsCards({
  totalIncome,
  totalExpenses,
  balance,
  prevIncome = 0,
  prevExpenses = 0,
}: StatsCardsProps) {
  const incomeChange = calculateChange(totalIncome, prevIncome)
  const expensesChange = calculateChange(totalExpenses, prevExpenses)
  const profit = totalIncome - totalExpenses

  const stats = [
    {
      name: 'הכנסות החודש',
      value: totalIncome,
      change: incomeChange,
      icon: TrendingUp,
      color: 'text-success-600',
      bgColor: 'bg-success-50',
    },
    {
      name: 'הוצאות החודש',
      value: totalExpenses,
      change: expensesChange,
      icon: TrendingDown,
      color: 'text-danger-600',
      bgColor: 'bg-danger-50',
      invertChange: true,
    },
    {
      name: 'רווח/הפסד',
      value: profit,
      icon: Wallet,
      color: profit >= 0 ? 'text-success-600' : 'text-danger-600',
      bgColor: profit >= 0 ? 'bg-success-50' : 'bg-danger-50',
    },
    {
      name: 'יתרה נוכחית',
      value: balance,
      icon: Wallet,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.name} padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">{stat.name}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {formatCurrency(stat.value)}
              </p>
              {stat.change !== undefined && (
                <div className="flex items-center mt-2">
                  {stat.change > 0 ? (
                    <ArrowUp className={cn('w-4 h-4', stat.invertChange ? 'text-danger-500' : 'text-success-500')} />
                  ) : stat.change < 0 ? (
                    <ArrowDown className={cn('w-4 h-4', stat.invertChange ? 'text-success-500' : 'text-danger-500')} />
                  ) : null}
                  <span
                    className={cn(
                      'text-sm font-medium mr-1',
                      stat.change > 0
                        ? stat.invertChange ? 'text-danger-500' : 'text-success-500'
                        : stat.change < 0
                        ? stat.invertChange ? 'text-success-500' : 'text-danger-500'
                        : 'text-gray-500'
                    )}
                  >
                    {Math.abs(stat.change)}%
                  </span>
                  <span className="text-xs text-gray-400 mr-1">מחודש קודם</span>
                </div>
              )}
            </div>
            <div className={cn('p-3 rounded-xl', stat.bgColor)}>
              <stat.icon className={cn('w-6 h-6', stat.color)} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
