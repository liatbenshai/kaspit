'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { supabase } from '@/lib/supabase'
import type { Category, Customer, IncomeFormData } from '@/types'

interface IncomeFormProps {
  initialData?: Partial<IncomeFormData> & { id?: string }
  onSubmit: (data: IncomeFormData) => Promise<void>
  onCancel: () => void
}

export function IncomeForm({ initialData, onSubmit, onCancel }: IncomeFormProps) {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  
  const [formData, setFormData] = useState<IncomeFormData>({
    category_id: initialData?.category_id || '',
    customer_id: initialData?.customer_id || '',
    amount: initialData?.amount || 0,
    document_type: initialData?.document_type || 'tax_invoice',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    description: initialData?.description || '',
    invoice_number: initialData?.invoice_number || '',
    payment_status: initialData?.payment_status || 'pending',
    payment_date: initialData?.payment_date || '',
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
      .eq('type', 'income')
      .eq('is_active', true)
      .order('name')

    if (cats) setCategories(cats)

    // Load customers
    const { data: custs } = await supabase
      .from('customers')
      .select('*')
      .eq('company_id', profile.company_id)
      .eq('is_active', true)
      .order('name')

    if (custs) setCustomers(custs)
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

  const handleChange = (field: keyof IncomeFormData, value: any) => {
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
          label="לקוח"
          options={[
            { value: '', label: 'ללא לקוח' },
            ...customers.map(c => ({ value: c.id, label: c.name }))
          ]}
          value={formData.customer_id || ''}
          onChange={(e) => handleChange('customer_id', e.target.value || undefined)}
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

        {formData.payment_status === 'paid' && (
          <Input
            label="תאריך תשלום"
            type="date"
            value={formData.payment_date || ''}
            onChange={(e) => handleChange('payment_date', e.target.value)}
          />
        )}
      </div>

      <Input
        label="תיאור"
        type="text"
        value={formData.description || ''}
        onChange={(e) => handleChange('description', e.target.value)}
        placeholder="תיאור ההכנסה..."
      />

      <div className="flex gap-3 pt-4">
        <Button type="submit" loading={loading}>
          {initialData?.id ? 'עדכן' : 'הוסף'} הכנסה
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          ביטול
        </Button>
      </div>
    </form>
  )
}
