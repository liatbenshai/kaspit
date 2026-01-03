'use client'

import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { formatCurrency, cn } from '@/lib/utils'

interface ForecastData {
  month: string
  projected: number
  income: number
  expenses: number
}

interface CashFlowForecastProps {
  data: ForecastData[]
}

export function CashFlowForecast({ data }: CashFlowForecastProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>תחזית תזרים מזומנים</CardTitle>
        </CardHeader>
        <div className="text-center py-8 text-gray-500">
          אין מספיק נתונים ליצירת תחזית.
          <br />
          <span className="text-sm">הוסיפי הכנסות והוצאות כדי לראות תחזית.</span>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>תחזית תזרים מזומנים</CardTitle>
      </CardHeader>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
            />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              labelFormatter={(label) => `תחזית ל${label}`}
            />
            <Bar dataKey="projected" name="תזרים צפוי" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.projected >= 0 ? '#22c55e' : '#ef4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="grid grid-cols-3 gap-4 text-center">
          {data.map((item) => (
            <div key={item.month}>
              <p className="text-xs text-gray-500">{item.month}</p>
              <p
                className={cn(
                  'text-lg font-semibold',
                  item.projected >= 0 ? 'text-success-600' : 'text-danger-600'
                )}
              >
                {formatCurrency(item.projected)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}
