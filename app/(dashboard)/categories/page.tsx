'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { Plus, Pencil, Trash2, Tag } from 'lucide-react'
import type { Category } from '@/types'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6',
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899',
]

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all')
  const [companyId, setCompanyId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
    color: '#3b82f6',
  })

  useEffect(() => {
    loadData()
  }, [])

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

      const { data: categoriesData } = await supabase
        .from('categories')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('type')
        .order('name')

      setCategories(categoriesData || [])
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
      if (editingCategory) {
        await supabase
          .from('categories')
          .update({
            name: formData.name,
            type: formData.type,
            color: formData.color,
          })
          .eq('id', editingCategory.id)
      } else {
        await supabase.from('categories').insert({
          company_id: companyId,
          name: formData.name,
          type: formData.type,
          color: formData.color,
        })
      }

      setShowModal(false)
      setEditingCategory(null)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving category:', error)
    }
  }

  const handleEdit = (category: Category) => {
    setEditingCategory(category)
    setFormData({
      name: category.name,
      type: category.type,
      color: category.color,
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('האם למחוק קטגוריה זו?')) return
    
    await supabase.from('categories').delete().eq('id', id)
    loadData()
  }

  const handleToggleActive = async (category: Category) => {
    await supabase
      .from('categories')
      .update({ is_active: !category.is_active })
      .eq('id', category.id)
    
    loadData()
  }

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'expense',
      color: '#3b82f6',
    })
  }

  const filteredCategories = categories.filter(c => 
    filterType === 'all' || c.type === filterType
  )

  const incomeCategories = filteredCategories.filter(c => c.type === 'income')
  const expenseCategories = filteredCategories.filter(c => c.type === 'expense')

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
        title="קטגוריות"
        description="ניהול קטגוריות הכנסה והוצאה"
        actions={
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" />
            הוספת קטגוריה
          </Button>
        }
      />

      {/* Filter */}
      <Card padding="md">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700">סינון:</span>
          <div className="flex gap-2">
            {[
              { value: 'all', label: 'הכל' },
              { value: 'income', label: 'הכנסות' },
              { value: 'expense', label: 'הוצאות' },
            ].map(option => (
              <button
                key={option.value}
                onClick={() => setFilterType(option.value as any)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterType === option.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Categories */}
        {(filterType === 'all' || filterType === 'income') && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-success-50 rounded-lg">
                <Tag className="w-5 h-5 text-success-600" />
              </div>
              <h3 className="text-lg font-semibold">קטגוריות הכנסה</h3>
              <Badge variant="success">{incomeCategories.length}</Badge>
            </div>

            {incomeCategories.length === 0 ? (
              <p className="text-gray-500 text-center py-8">אין קטגוריות הכנסה</p>
            ) : (
              <div className="space-y-2">
                {incomeCategories.map(category => (
                  <div
                    key={category.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      category.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className={category.is_active ? '' : 'text-gray-400'}>
                        {category.name}
                      </span>
                      {!category.is_active && (
                        <Badge variant="default" size="sm">לא פעיל</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(category)}
                        className="text-xs text-gray-500 hover:text-primary-600"
                      >
                        {category.is_active ? 'השבת' : 'הפעל'}
                      </button>
                      <button
                        onClick={() => handleEdit(category)}
                        className="p-1 text-gray-400 hover:text-primary-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
                        className="p-1 text-gray-400 hover:text-danger-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Expense Categories */}
        {(filterType === 'all' || filterType === 'expense') && (
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-danger-50 rounded-lg">
                <Tag className="w-5 h-5 text-danger-600" />
              </div>
              <h3 className="text-lg font-semibold">קטגוריות הוצאה</h3>
              <Badge variant="danger">{expenseCategories.length}</Badge>
            </div>

            {expenseCategories.length === 0 ? (
              <p className="text-gray-500 text-center py-8">אין קטגוריות הוצאה</p>
            ) : (
              <div className="space-y-2">
                {expenseCategories.map(category => (
                  <div
                    key={category.id}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      category.is_active ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className={category.is_active ? '' : 'text-gray-400'}>
                        {category.name}
                      </span>
                      {!category.is_active && (
                        <Badge variant="default" size="sm">לא פעיל</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(category)}
                        className="text-xs text-gray-500 hover:text-primary-600"
                      >
                        {category.is_active ? 'השבת' : 'הפעל'}
                      </button>
                      <button
                        onClick={() => handleEdit(category)}
                        className="p-1 text-gray-400 hover:text-primary-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(category.id)}
                        className="p-1 text-gray-400 hover:text-danger-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingCategory(null)
          resetForm()
        }}
        title={editingCategory ? 'עריכת קטגוריה' : 'הוספת קטגוריה'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="שם הקטגוריה"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <Select
            label="סוג"
            options={[
              { value: 'income', label: 'הכנסה' },
              { value: 'expense', label: 'הוצאה' },
            ]}
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">צבע</label>
            <div className="flex flex-wrap gap-2">
              {PRESET_COLORS.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setFormData({ ...formData, color })}
                  className={`w-8 h-8 rounded-full transition-transform ${
                    formData.color === color ? 'ring-2 ring-offset-2 ring-primary-500 scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit">
              {editingCategory ? 'עדכון' : 'הוספה'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false)
                setEditingCategory(null)
                resetForm()
              }}
            >
              ביטול
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
