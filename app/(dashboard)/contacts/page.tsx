'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { supabase } from '@/lib/supabase'
import { Plus, Search, Pencil, Trash2, Users, Building2 } from 'lucide-react'
import type { Supplier, Customer } from '@/types'

type ContactType = 'suppliers' | 'customers'

export default function ContactsPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState<ContactType>('suppliers')
  const [editingContact, setEditingContact] = useState<Supplier | Customer | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    address: '',
    tax_id: '',
    payment_terms: '30',
    notes: '',
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

      const { data: suppliersData } = await supabase
        .from('suppliers')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name')

      setSuppliers(suppliersData || [])

      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name')

      setCustomers(customersData || [])
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
      const contactData = {
        company_id: companyId,
        name: formData.name,
        contact_name: formData.contact_name || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        tax_id: formData.tax_id || null,
        payment_terms: parseInt(formData.payment_terms) || 30,
        notes: formData.notes || null,
      }

      const table = activeTab

      if (editingContact) {
        await supabase
          .from(table)
          .update(contactData)
          .eq('id', editingContact.id)
      } else {
        await supabase.from(table).insert(contactData)
      }

      setShowModal(false)
      setEditingContact(null)
      resetForm()
      loadData()
    } catch (error) {
      console.error('Error saving contact:', error)
    }
  }

  const handleEdit = (contact: Supplier | Customer) => {
    setEditingContact(contact)
    setFormData({
      name: contact.name,
      contact_name: contact.contact_name || '',
      phone: contact.phone || '',
      email: contact.email || '',
      address: contact.address || '',
      tax_id: contact.tax_id || '',
      payment_terms: String(contact.payment_terms),
      notes: contact.notes || '',
    })
    setShowModal(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm(`האם למחוק ${activeTab === 'suppliers' ? 'ספק' : 'לקוח'} זה?`)) return
    
    await supabase.from(activeTab).delete().eq('id', id)
    loadData()
  }

  const handleToggleActive = async (contact: Supplier | Customer) => {
    await supabase
      .from(activeTab)
      .update({ is_active: !contact.is_active })
      .eq('id', contact.id)
    
    loadData()
  }

  const resetForm = () => {
    setFormData({
      name: '',
      contact_name: '',
      phone: '',
      email: '',
      address: '',
      tax_id: '',
      payment_terms: '30',
      notes: '',
    })
  }

  const currentContacts = activeTab === 'suppliers' ? suppliers : customers
  const filteredContacts = currentContacts.filter(c =>
    c.name.includes(searchTerm) ||
    c.contact_name?.includes(searchTerm) ||
    c.email?.includes(searchTerm)
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
        title="ספקים ולקוחות"
        description="ניהול אנשי קשר עסקיים"
        actions={
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" />
            הוספת {activeTab === 'suppliers' ? 'ספק' : 'לקוח'}
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'suppliers'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building2 className="w-5 h-5" />
          ספקים
          <Badge variant="default">{suppliers.length}</Badge>
        </button>
        <button
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
            activeTab === 'customers'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Users className="w-5 h-5" />
          לקוחות
          <Badge variant="default">{customers.length}</Badge>
        </button>
      </div>

      {/* Search */}
      <Card padding="md">
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="חיפוש לפי שם, איש קשר או אימייל..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pr-10"
          />
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>שם</TableHead>
              <TableHead>איש קשר</TableHead>
              <TableHead>טלפון</TableHead>
              <TableHead>אימייל</TableHead>
              <TableHead>תנאי תשלום</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  אין {activeTab === 'suppliers' ? 'ספקים' : 'לקוחות'} להצגה
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">{contact.name}</TableCell>
                  <TableCell>{contact.contact_name || '-'}</TableCell>
                  <TableCell>{contact.phone || '-'}</TableCell>
                  <TableCell>{contact.email || '-'}</TableCell>
                  <TableCell>{contact.payment_terms} ימים</TableCell>
                  <TableCell>
                    <Badge variant={contact.is_active ? 'success' : 'default'}>
                      {contact.is_active ? 'פעיל' : 'לא פעיל'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(contact)}
                        className="text-xs text-gray-500 hover:text-primary-600"
                      >
                        {contact.is_active ? 'השבת' : 'הפעל'}
                      </button>
                      <button
                        onClick={() => handleEdit(contact)}
                        className="p-1 text-gray-400 hover:text-primary-600"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(contact.id)}
                        className="p-1 text-gray-400 hover:text-danger-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false)
          setEditingContact(null)
          resetForm()
        }}
        title={`${editingContact ? 'עריכת' : 'הוספת'} ${activeTab === 'suppliers' ? 'ספק' : 'לקוח'}`}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label={activeTab === 'suppliers' ? 'שם הספק' : 'שם הלקוח'}
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="איש קשר"
              value={formData.contact_name}
              onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
            />
            <Input
              label="טלפון"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="אימייל"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              label="ח.פ / ע.מ"
              value={formData.tax_id}
              onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
            />
          </div>

          <Input
            label="כתובת"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />

          <Input
            label="תנאי תשלום (ימים)"
            type="number"
            value={formData.payment_terms}
            onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">הערות</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="submit">
              {editingContact ? 'עדכון' : 'הוספה'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false)
                setEditingContact(null)
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
