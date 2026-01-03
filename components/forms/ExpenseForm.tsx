'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import type { Category, Supplier, ExpenseFormData } from '@/types'

interface ExpenseFormProps {
  initialData?: Partial<ExpenseFormData> & { id?: string }
  onSubmit: (data: ExpenseFormData) => Promise<void>
  onCancel: () => void
}

export function ExpenseForm({ initialData, onSubmit, onCancel }: ExpenseFormProps) {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  
  const [formData, setFormData] = useState<ExpenseFormData>({
    category_id: initialData?.category_id || '',
    supplier_id: initialData?.supplier_id || '',
    amount: initialData?.amount || 0,
    date: initialData?.date || new Date().toISOString().split('T')[0],
    description: initialData?.description || '',
    invoice_number: initialData?.invoice_number || '',
    payment_status: initialData?.payment_status || 'pending',
    due_date: initialData?.due_date || '',
    paid_date: initialData?.paid_date || '',
    is_recurring: initialData?.is_recurring || false,
    recurring_day: initialData?.recurring_day || undefined,
  })

  useEffect(() => {
    loadOptions()
  }, [])

  const loadOptions = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .single()

    if (!profile?.company_id) return

    // Load categories
    const { data: cats } = await supabase
      .from('categories')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('type', 'expense')
      .eq('is_active', true)
      .order('name')

    if (cats) setCategories(cats)

    // Load suppliers
    const { data: supps } = await supabase
      .from('suppliers')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('is_active', true)
      .order('name')

    if (supps) setSuppliers(supps)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await onSubmit(formData)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: keyof ExpenseFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="סכום"
          type="number"
          value={formData.amount || ''}
          onChange={(e) => handleChange('amount', parseFloat(e.target.value) || 0)}
          placeholder="0"
          required
        />

        <Input
          label="תאריך"
          type="date"
          value={formData.date}
          onChange={(e) => handleChange('date', e.target.value)}
          required
        />

        <Select
          label="קטגוריה"
          options={categories.map(c => ({ value: c.id, label: c.name }))}
          value={formData.category_id}
          onChange={(e) => handleChange('category_id', e.target.value)}
          placeholder="בחר קטגוריה"
        />

        <Select
          label="ספק"
          options={[
            { value: '', label: 'ללא ספק' },
            ...suppliers.map(s => ({ value: s.id, label: s.name }))
          ]}
          value={formData.supplier_id || ''}
          onChange={(e) => handleChange('supplier_id', e.target.value || undefined)}
        />

        <Input
          label="מספר חשבונית"
          type="text"
          value={formData.invoice_number || ''}
          onChange={(e) => handleChange('invoice_number', e.target.value)}
          placeholder="INV-001"
        />

        <Select
          label="סטטוס תשלום"
          options={[
            { value: 'pending', label: 'ממתין' },
            { value: 'partial', label: 'שולם חלקית' },
            { value: 'paid', label: 'שולם' },
          ]}
          value={formData.payment_status}
          onChange={(e) => handleChange('payment_status', e.target.value as any)}
        />

        <Input
          label="תאריך יעד לתשלום"
          type="date"
          value={formData.due_date || ''}
          onChange={(e) => handleChange('due_date', e.target.value)}
        />

        {formData.payment_status === 'paid' && (
          <Input
            label="תאריך תשלום בפועל"
            type="date"
            value={formData.paid_date || ''}
            onChange={(e) => handleChange('paid_date', e.target.value)}
          />
        )}
      </div>

      <Input
        label="תיאור"
        type="text"
        value={formData.description || ''}
        onChange={(e) => handleChange('description', e.target.value)}
        placeholder="תיאור ההוצאה..."
      />

      {/* Recurring expense */}
      <div className="border-t border-gray-200 pt-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={formData.is_recurring}
            onChange={(e) => handleChange('is_recurring', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm font-medium text-gray-700">הוצאה חוזרת (קבועה)</span>
        </label>

        {formData.is_recurring && (
          <div className="mt-3">
            <Input
              label="יום בחודש לחיוב"
              type="number"
              min={1}
              max={31}
              value={formData.recurring_day || ''}
              onChange={(e) => handleChange('recurring_day', parseInt(e.target.value) || undefined)}
              placeholder="1-31"
            />
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="submit" loading={loading}>
          {initialData?.id ? 'עדכן' : 'הוסף'} הוצאה
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          ביטול
        </Button>
      </div>
    </form>
  )
}
