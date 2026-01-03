'use client'

import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { cn } from '@/lib/utils'
import { AlertCircle, Lightbulb, TrendingUp, Bell, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import type { Insight } from '@/lib/insights'

interface InsightsProps {
  insights: Insight[]
}

const iconMap = {
  alert: Bell,
  insight: Lightbulb,
  recommendation: Lightbulb,
  forecast: TrendingUp,
}

const severityColors = {
  info: {
    bg: 'bg-primary-50',
    border: 'border-primary-200',
    icon: 'text-primary-600',
    text: 'text-primary-800',
  },
  warning: {
    bg: 'bg-warning-50',
    border: 'border-warning-200',
    icon: 'text-warning-600',
    text: 'text-warning-800',
  },
  critical: {
    bg: 'bg-danger-50',
    border: 'border-danger-200',
    icon: 'text-danger-600',
    text: 'text-danger-800',
  },
  success: {
    bg: 'bg-success-50',
    border: 'border-success-200',
    icon: 'text-success-600',
    text: 'text-success-800',
  },
}

export function Insights({ insights }: InsightsProps) {
  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>תובנות והמלצות</CardTitle>
        </CardHeader>
        <div className="text-center py-8 text-gray-500">
          <Lightbulb className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>אין תובנות חדשות כרגע.</p>
          <p className="text-sm mt-1">נמשיך לנתח את הנתונים שלך.</p>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>תובנות והמלצות</CardTitle>
      </CardHeader>
      <div className="space-y-3">
        {insights.slice(0, 5).map((insight) => {
          const Icon = iconMap[insight.type]
          const colors = severityColors[insight.severity]

          return (
            <div
              key={insight.id}
              className={cn(
                'p-4 rounded-lg border',
                colors.bg,
                colors.border
              )}
            >
              <div className="flex items-start gap-3">
                <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', colors.icon)} />
                <div className="flex-1 min-w-0">
                  <h4 className={cn('font-medium', colors.text)}>
                    {insight.title}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">{insight.message}</p>
                  {insight.action && insight.actionUrl && (
                    <Link
                      href={insight.actionUrl}
                      className={cn(
                        'inline-flex items-center gap-1 text-sm font-medium mt-2',
                        colors.icon
                      )}
                    >
                      {insight.action}
                      <ArrowLeft className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
