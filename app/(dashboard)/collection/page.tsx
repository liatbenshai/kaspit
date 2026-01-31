'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDateShort, cn } from '@/lib/utils'
import { 
  Clock, AlertTriangle, CheckCircle, Calendar, TrendingUp, 
  Phone, Mail, MessageCircle, ChevronDown, ChevronUp, Filter, Check,
  DollarSign, Send, History
} from 'lucide-react'
import type { Income, Customer } from '@/types'

interface CollectionItem extends Omit<Income, 'customer'> {
  customer?: Customer | null
  days_until_due: number
  days_overdue: number
  is_overdue: boolean
  collection_status?: string
  last_reminder_date?: string
  reminder_count?: number
  collection_notes?: string
  promised_date?: string
}

interface WeekSummary {
  label: string
  startDate: Date
  endDate: Date
  items: CollectionItem[]
  total: number
}

const collectionStatuses = [
  { value: 'none', label: 'ללא תזכורת', color: 'default' },
  { value: 'reminder_sent', label: 'נשלחה תזכורת', color: 'warning' },
  { value: 'promised', label: 'הבטיח לשלם', color: 'info' },
  { value: 'partial_received', label: 'שולם חלקית', color: 'success' },
  { value: 'dispute', label: 'במחלוקת', color: 'danger' },
  { value: 'legal', label: 'טיפול משפטי', color: 'danger' },
]

const getCollectionStatus = (status: string) => collectionStatuses.find(s => s.value === status) || collectionStatuses[0]

export default function CollectionPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState<string>('')
  const [items, setItems] = useState<CollectionItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterCollectionStatus, setFilterCollectionStatus] = useState<string>('')
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list')
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set(['week_0', 'week_1']))
  
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showReminderModal, setShowReminderModal] = useState(false)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showNotesModal, setShowNotesModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null)
  const [reminderHistory, setReminderHistory] = useState<any[]>([])
  
  const [paymentData, setPaymentData] = useState({ 
    payment_date: new Date().toISOString().split('T')[0], 
    payment_method: '',
    actual_payer_name: '',
    receipt_number: '',
    project_number: '',
  })
  const [reminderType, setReminderType] = useState<'email' | 'whatsapp' | 'phone'>('whatsapp')
  const [reminderMessage, setReminderMessage] = useState('')
  const [notesData, setNotesData] = useState({ collection_status: '', collection_notes: '', promised_date: '' })
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const { data: company } = await supabase.from('companies').select('name').eq('id', profile.company_id).single()
      setCompanyName(company?.name || '')

      const { data: incomeData } = await supabase
        .from('income')
        .select('*, customer:customers(*)')
        .eq('company_id', profile.company_id)
        .neq('payment_status', 'paid')
        .in('document_type', ['invoice', 'tax_invoice'])
        .order('due_date', { ascending: true })

      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)

      setCustomers(customersData || [])

      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const processedItems: CollectionItem[] = (incomeData || []).map(item => {
        const dueDate = item.due_date ? new Date(item.due_date) : null
        let daysUntilDue = 0
        let daysOverdue = 0
        let isOverdue = false

        if (dueDate) {
          dueDate.setHours(0, 0, 0, 0)
          const diffTime = dueDate.getTime() - today.getTime()
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
          
          if (diffDays < 0) {
            isOverdue = true
            daysOverdue = Math.abs(diffDays)
          } else {
            daysUntilDue = diffDays
          }
        }

        return { ...item, days_until_due: daysUntilDue, days_overdue: daysOverdue, is_overdue: isOverdue }
      })

      setItems(processedItems)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const openReminderModal = (item: CollectionItem) => {
    setSelectedItem(item)
    setReminderType('whatsapp')
    generateReminderMessage(item, 'whatsapp')
    setShowReminderModal(true)
  }

  const openPaymentModal = (item: CollectionItem) => {
    setSelectedItem(item)
    // מילוי אוטומטי של מספר פרויקט אם קיים
    setPaymentData(prev => ({
      ...prev,
      project_number: (item as any).project_number || '',
    }))
    setShowPaymentModal(true)
  }

  const generateReminderMessage = (item: CollectionItem, type: 'email' | 'whatsapp' | 'phone') => {
    const customerName = item.customer?.name || 'לקוח יקר'
    const amount = formatCurrency(item.amount)
    const invoiceNumber = item.invoice_number || 'ללא מספר'
    const dueDate = item.due_date ? formatDateShort(item.due_date) : ''
    const daysText = item.is_overdue ? `באיחור של ${item.days_overdue} ימים` : ''

    if (type === 'whatsapp') {
      setReminderMessage(
        `שלום ${customerName},\n` +
        `תזכורת לתשלום חשבונית מס׳ ${invoiceNumber} על סך ${amount}.\n` +
        (dueDate ? `מועד לתשלום: ${dueDate}\n` : '') +
        (daysText ? `${daysText}\n` : '') +
        `תודה רבה,\n${companyName}`
      )
    } else if (type === 'email') {
      setReminderMessage(
        `שלום ${customerName},\n\n` +
        `ברצוננו להזכירך כי חשבונית מס׳ ${invoiceNumber} על סך ${amount} טרם שולמה.\n` +
        (dueDate ? `תאריך לתשלום: ${dueDate}\n` : '') +
        (daysText ? `\n${daysText}\n` : '') +
        `\nנודה לטיפולך בהקדם.\n\n` +
        `בברכה,\n${companyName}`
      )
    } else {
      setReminderMessage(
        `להתקשר ל${customerName} - ${item.customer?.phone || 'אין טלפון'}\n` +
        `חשבונית ${invoiceNumber}, סכום ${amount}\n` +
        (daysText || '')
      )
    }
  }

  const sendReminder = async () => {
    if (!selectedItem || !companyId) return

    const customer = selectedItem.customer
    
    if (reminderType === 'whatsapp' && customer?.phone) {
      const phone = customer.phone.replace(/[^0-9]/g, '')
      const israelPhone = phone.startsWith('0') ? '972' + phone.slice(1) : phone
      const encoded = encodeURIComponent(reminderMessage)
      window.open(`https://wa.me/${israelPhone}?text=${encoded}`, '_blank')
    } else if (reminderType === 'email' && customer?.email) {
      const subject = encodeURIComponent(`תזכורת: חשבונית מס׳ ${selectedItem.invoice_number || ''} לתשלום`)
      const body = encodeURIComponent(reminderMessage)
      window.open(`mailto:${customer.email}?subject=${subject}&body=${body}`, '_blank')
    } else if (reminderType === 'phone' && customer?.phone) {
      window.open(`tel:${customer.phone}`, '_blank')
    }

    try {
      await supabase.from('collection_reminders').insert({
        company_id: companyId,
        income_id: selectedItem.id,
        reminder_type: reminderType,
        sent_to: reminderType === 'email' ? customer?.email : customer?.phone,
        message: reminderMessage,
      })

      await supabase.from('income').update({
        collection_status: 'reminder_sent',
        last_reminder_date: new Date().toISOString().split('T')[0],
        reminder_count: (selectedItem.reminder_count || 0) + 1,
      }).eq('id', selectedItem.id)

      setSuccessMessage('התזכורת נשלחה!')
      setShowReminderModal(false)
      loadData()
    } catch (error) {
      console.error('Error saving reminder:', error)
    }
  }

  const openHistoryModal = async (item: CollectionItem) => {
    setSelectedItem(item)
    const { data } = await supabase
      .from('collection_reminders')
      .select('*')
      .eq('income_id', item.id)
      .order('sent_at', { ascending: false })
    setReminderHistory(data || [])
    setShowHistoryModal(true)
  }

  const openNotesModal = (item: CollectionItem) => {
    setSelectedItem(item)
    setNotesData({
      collection_status: item.collection_status || 'none',
      collection_notes: item.collection_notes || '',
      promised_date: item.promised_date || '',
    })
    setShowNotesModal(true)
  }

  const saveNotes = async () => {
    if (!selectedItem) return
    await supabase.from('income').update({
      collection_status: notesData.collection_status,
      collection_notes: notesData.collection_notes || null,
      promised_date: notesData.promised_date || null,
    }).eq('id', selectedItem.id)
    setShowNotesModal(false)
    setSuccessMessage('הפרטים עודכנו!')
    loadData()
  }

  const markAsPaid = async () => {
    if (!selectedItem) return
    await supabase.from('income').update({
      payment_status: 'paid',
      payment_date: paymentData.payment_date,
      payment_method: paymentData.payment_method || null,
      actual_payer_name: paymentData.actual_payer_name || null,
      receipt_number: paymentData.receipt_number || null,
      project_number: paymentData.project_number || null,
      collection_status: 'none',
    }).eq('id', selectedItem.id)
    setShowPaymentModal(false)
    setSelectedItem(null)
    setPaymentData({ 
      payment_date: new Date().toISOString().split('T')[0], 
      payment_method: '',
      actual_payer_name: '',
      receipt_number: '',
      project_number: '',
    })
    setSuccessMessage('החשבונית סומנה כשולמה!')
    loadData()
  }

  const filteredItems = items.filter(item => {
    if (filterCustomer && item.customer_id !== filterCustomer) return false
    if (filterStatus === 'overdue' && !item.is_overdue) return false
    if (filterStatus === 'upcoming' && item.is_overdue) return false
    if (filterStatus === 'this_week' && (item.is_overdue || item.days_until_due > 7)) return false
    if (filterCollectionStatus && item.collection_status !== filterCollectionStatus) return false
    return true
  })

  const getWeekSummaries = (): WeekSummary[] => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const weeks: WeekSummary[] = []
    
    const overdueItems = filteredItems.filter(i => i.is_overdue)
    if (overdueItems.length > 0) {
      weeks.push({
        label: '⚠️ באיחור',
        startDate: new Date(0),
        endDate: new Date(today.getTime() - 24 * 60 * 60 * 1000),
        items: overdueItems.sort((a, b) => b.days_overdue - a.days_overdue),
        total: overdueItems.reduce((sum, i) => sum + i.amount, 0),
      })
    }

    const endOfWeek = new Date(today)
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()))
    
    const thisWeekItems = filteredItems.filter(i => !i.is_overdue && i.days_until_due <= (6 - today.getDay()))
    weeks.push({
      label: '📅 השבוע',
      startDate: today,
      endDate: endOfWeek,
      items: thisWeekItems,
      total: thisWeekItems.reduce((sum, i) => sum + i.amount, 0),
    })

    for (let w = 1; w <= 4; w++) {
      const weekStart = new Date(endOfWeek)
      weekStart.setDate(weekStart.getDate() + 1 + (w - 1) * 7)
      const weekEnd = new Date(weekStart)
      weekEnd.setDate(weekEnd.getDate() + 6)

      const weekItems = filteredItems.filter(i => {
        if (i.is_overdue || !i.due_date) return false
        const dueDate = new Date(i.due_date)
        return dueDate >= weekStart && dueDate <= weekEnd
      })

      weeks.push({
        label: w === 1 ? '📆 שבוע הבא' : `שבוע ${w + 1}`,
        startDate: weekStart,
        endDate: weekEnd,
        items: weekItems,
        total: weekItems.reduce((sum, i) => sum + i.amount, 0),
      })
    }

    const laterItems = filteredItems.filter(i => !i.is_overdue && i.days_until_due > 35)
    if (laterItems.length > 0) {
      weeks.push({
        label: '📌 מאוחר יותר',
        startDate: new Date(today.getTime() + 35 * 24 * 60 * 60 * 1000),
        endDate: new Date(9999, 11, 31),
        items: laterItems,
        total: laterItems.reduce((sum, i) => sum + i.amount, 0),
      })
    }

    return weeks
  }

  const toggleWeek = (weekId: string) => {
    setExpandedWeeks(prev => {
      const newSet = new Set(prev)
      if (newSet.has(weekId)) newSet.delete(weekId)
      else newSet.add(weekId)
      return newSet
    })
  }

  const totalOpen = items.reduce((sum, i) => sum + i.amount, 0)
  const totalOverdue = items.filter(i => i.is_overdue).reduce((sum, i) => sum + i.amount, 0)
  const totalThisWeek = items.filter(i => !i.is_overdue && i.days_until_due <= 7).reduce((sum, i) => sum + i.amount, 0)
  const totalNextMonth = items.filter(i => !i.is_overdue && i.days_until_due <= 30).reduce((sum, i) => sum + i.amount, 0)
  const overdueCount = items.filter(i => i.is_overdue).length
  const needsReminderCount = items.filter(i => i.is_overdue && (!i.collection_status || i.collection_status === 'none')).length

  const weeks = getWeekSummaries()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="גבייה ותזרים צפוי" description="מעקב חשבוניות, תזכורות גבייה ותזרים הכנסות" />

      {successMessage && <Alert variant="success" onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>}

      {needsReminderCount > 0 && (
        <Alert variant="warning">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              <span>{needsReminderCount} חשבוניות באיחור ללא תזכורת</span>
            </div>
            <Button size="sm" variant="outline" onClick={() => setFilterStatus('overdue')}>הצג</Button>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="md" className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-lg"><DollarSign className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-sm text-blue-600">סה״כ פתוח</p>
              <p className="text-xl font-bold text-blue-800">{formatCurrency(totalOpen)}</p>
              <p className="text-xs text-blue-600">{items.length} חשבוניות</p>
            </div>
          </div>
        </Card>

        <Card padding="md" className={cn("bg-gradient-to-br border", totalOverdue > 0 ? "from-red-50 to-red-100 border-red-200" : "from-green-50 to-green-100 border-green-200")}>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", totalOverdue > 0 ? "bg-red-500" : "bg-green-500")}>
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className={cn("text-sm", totalOverdue > 0 ? "text-red-600" : "text-green-600")}>באיחור</p>
              <p className={cn("text-xl font-bold", totalOverdue > 0 ? "text-red-800" : "text-green-800")}>{formatCurrency(totalOverdue)}</p>
              <p className={cn("text-xs", totalOverdue > 0 ? "text-red-600" : "text-green-600")}>{overdueCount} חשבוניות</p>
            </div>
          </div>
        </Card>

        <Card padding="md" className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 rounded-lg"><Calendar className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-sm text-amber-600">צפוי השבוע</p>
              <p className="text-xl font-bold text-amber-800">{formatCurrency(totalThisWeek)}</p>
            </div>
          </div>
        </Card>

        <Card padding="md" className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500 rounded-lg"><TrendingUp className="w-5 h-5 text-white" /></div>
            <div>
              <p className="text-sm text-purple-600">צפוי החודש</p>
              <p className="text-xl font-bold text-purple-800">{formatCurrency(totalNextMonth)}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding="md">
        <div className="flex flex-wrap gap-4 items-center">
          <Filter className="w-4 h-4 text-gray-500" />
          <Select options={[
            { value: 'all', label: 'כל החשבוניות' },
            { value: 'overdue', label: '⚠️ באיחור' },
            { value: 'this_week', label: '📅 השבוע' },
            { value: 'upcoming', label: '📆 עתידיות' },
          ]} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-40" />
          <Select options={[{ value: '', label: 'סטטוס גבייה' }, ...collectionStatuses.map(s => ({ value: s.value, label: s.label }))]}
            value={filterCollectionStatus} onChange={(e) => setFilterCollectionStatus(e.target.value)} className="w-44" />
          <Select options={[{ value: '', label: 'כל הלקוחות' }, ...customers.map(c => ({ value: c.id, label: c.name }))]}
            value={filterCustomer} onChange={(e) => setFilterCustomer(e.target.value)} className="w-48" />
          <div className="flex-1" />
          <div className="flex gap-2">
            <Button variant={viewMode === 'list' ? 'primary' : 'outline'} size="sm" onClick={() => setViewMode('list')}>רשימה</Button>
            <Button variant={viewMode === 'timeline' ? 'primary' : 'outline'} size="sm" onClick={() => setViewMode('timeline')}>ציר זמן</Button>
          </div>
        </div>
      </Card>

      {viewMode === 'timeline' && (
        <div className="space-y-4">
          {weeks.map((week, weekIndex) => {
            const weekId = `week_${weekIndex}`
            const isExpanded = expandedWeeks.has(weekId)
            const isOverdueWeek = week.label.includes('באיחור')

            return (
              <Card key={weekId} padding="none" className={cn(isOverdueWeek && "border-red-300 bg-red-50/50")}>
                <button onClick={() => toggleWeek(weekId)} className="w-full p-4 flex items-center justify-between hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-medium">{week.label}</span>
                    <Badge variant={isOverdueWeek ? 'danger' : 'default'}>{week.items.length}</Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={cn("text-xl font-bold", isOverdueWeek ? "text-red-600" : "text-gray-800")}>{formatCurrency(week.total)}</span>
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </button>

                {isExpanded && week.items.length > 0 && (
                  <div className="border-t">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>לקוח</TableHead>
                          <TableHead>מס׳ חשבונית</TableHead>
                          <TableHead>פרויקט</TableHead>
                          <TableHead>לתשלום</TableHead>
                          <TableHead>סטטוס</TableHead>
                          <TableHead>סכום</TableHead>
                          <TableHead>פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {week.items.map(item => (
                          <TableRow key={item.id} className={cn(item.is_overdue && "bg-red-50")}>
                            <TableCell>
                              <p className="font-medium">{item.customer?.name || '-'}</p>
                              {item.customer?.phone && <p className="text-xs text-gray-500">{item.customer.phone}</p>}
                            </TableCell>
                            <TableCell className="font-mono">{item.invoice_number || '-'}</TableCell>
                            <TableCell className="font-mono text-sm">{(item as any).project_number || '-'}</TableCell>
                            <TableCell>
                              <p>{item.due_date ? formatDateShort(item.due_date) : '-'}</p>
                              {item.is_overdue && <p className="text-xs text-red-600">{item.days_overdue} ימים</p>}
                            </TableCell>
                            <TableCell>
                              <button onClick={() => openNotesModal(item)}>
                                <Badge variant={getCollectionStatus(item.collection_status || 'none').color as 'default' | 'success' | 'warning' | 'danger' | 'info'}>
                                  {getCollectionStatus(item.collection_status || 'none').label}
                                </Badge>
                              </button>
                            </TableCell>
                            <TableCell className="font-bold text-lg">{formatCurrency(item.amount)}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="sm" variant="ghost" onClick={() => openReminderModal(item)}><Send className="w-4 h-4" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => openHistoryModal(item)}><History className="w-4 h-4" /></Button>
                                <Button size="sm" variant="outline" onClick={() => openPaymentModal(item)}><Check className="w-4 h-4" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {isExpanded && week.items.length === 0 && <div className="p-8 text-center text-gray-500 border-t">אין חשבוניות</div>}
              </Card>
            )
          })}
        </div>
      )}

      {viewMode === 'list' && (
        <Card padding="none">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>לקוח</TableHead>
                <TableHead>מס׳ חשבונית</TableHead>
                <TableHead>פרויקט</TableHead>
                <TableHead>תאריך</TableHead>
                <TableHead>לתשלום</TableHead>
                <TableHead>סטטוס גבייה</TableHead>
                <TableHead>סכום</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="text-gray-500">אין חשבוניות פתוחות!</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map(item => (
                  <TableRow key={item.id} className={cn(item.is_overdue && "bg-red-50")}>
                    <TableCell>
                      <p className="font-medium">{item.customer?.name || '-'}</p>
                      {item.customer?.phone && <a href={`tel:${item.customer.phone}`} className="text-xs text-blue-600">{item.customer.phone}</a>}
                    </TableCell>
                    <TableCell className="font-mono">{item.invoice_number || '-'}</TableCell>
                    <TableCell className="font-mono text-sm">{(item as any).project_number || '-'}</TableCell>
                    <TableCell>{formatDateShort(item.date)}</TableCell>
                    <TableCell>
                      <p>{item.due_date ? formatDateShort(item.due_date) : '-'}</p>
                      {item.is_overdue && <p className="text-xs text-red-600 flex items-center gap-1"><Clock className="w-3 h-3" />{item.days_overdue} ימים</p>}
                    </TableCell>
                    <TableCell>
                      <button onClick={() => openNotesModal(item)}>
                        <Badge variant={getCollectionStatus(item.collection_status || 'none').color as 'default' | 'success' | 'warning' | 'danger' | 'info'}>
                          {getCollectionStatus(item.collection_status || 'none').label}
                        </Badge>
                      </button>
                      {item.promised_date && <p className="text-xs text-gray-500">הבטיח: {formatDateShort(item.promised_date)}</p>}
                    </TableCell>
                    <TableCell className="font-bold">{formatCurrency(item.amount)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => openReminderModal(item)} title="תזכורת"><Send className="w-4 h-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => openHistoryModal(item)} title="היסטוריה"><History className="w-4 h-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => openPaymentModal(item)}><Check className="w-4 h-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* מודל תזכורת */}
      <Modal isOpen={showReminderModal} onClose={() => setShowReminderModal(false)} title="שליחת תזכורת" size="lg">
        {selectedItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{selectedItem.customer?.name || '-'}</p>
                <p className="text-sm text-gray-500">
                  חשבונית {selectedItem.invoice_number || '-'}
                  {(selectedItem as any).project_number && <span> | פרויקט {(selectedItem as any).project_number}</span>}
                </p>
                {selectedItem.is_overdue && <p className="text-sm text-red-600">{selectedItem.days_overdue} ימים באיחור</p>}
              </div>
              <p className="text-2xl font-bold text-primary-600">{formatCurrency(selectedItem.amount)}</p>
            </div>

            <div className="flex gap-2">
              <Button variant={reminderType === 'whatsapp' ? 'primary' : 'outline'} onClick={() => { setReminderType('whatsapp'); generateReminderMessage(selectedItem, 'whatsapp') }} disabled={!selectedItem.customer?.phone}>
                <MessageCircle className="w-4 h-4" />וואטסאפ
              </Button>
              <Button variant={reminderType === 'email' ? 'primary' : 'outline'} onClick={() => { setReminderType('email'); generateReminderMessage(selectedItem, 'email') }} disabled={!selectedItem.customer?.email}>
                <Mail className="w-4 h-4" />מייל
              </Button>
              <Button variant={reminderType === 'phone' ? 'primary' : 'outline'} onClick={() => { setReminderType('phone'); generateReminderMessage(selectedItem, 'phone') }} disabled={!selectedItem.customer?.phone}>
                <Phone className="w-4 h-4" />טלפון
              </Button>
            </div>

            {!selectedItem.customer?.phone && !selectedItem.customer?.email && (
              <Alert variant="warning">אין פרטי קשר ללקוח</Alert>
            )}

            <textarea className="w-full h-40 p-3 border rounded-lg text-sm" value={reminderMessage} onChange={(e) => setReminderMessage(e.target.value)} dir="rtl" />

            <div className="flex gap-3 pt-4 border-t">
              <Button onClick={sendReminder} disabled={!selectedItem.customer?.phone && !selectedItem.customer?.email}>
                <Send className="w-4 h-4" />שלח
              </Button>
              <Button variant="outline" onClick={() => setShowReminderModal(false)}>ביטול</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* מודל היסטוריה */}
      <Modal isOpen={showHistoryModal} onClose={() => setShowHistoryModal(false)} title="היסטוריית תזכורות">
        {selectedItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium">{selectedItem.customer?.name}</p>
              <p className="text-sm text-gray-500">
                חשבונית {selectedItem.invoice_number || '-'} | {formatCurrency(selectedItem.amount)}
                {(selectedItem as any).project_number && <span> | פרויקט {(selectedItem as any).project_number}</span>}
              </p>
            </div>

            {reminderHistory.length === 0 ? (
              <p className="text-center text-gray-500 py-8">לא נשלחו תזכורות</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {reminderHistory.map((r) => (
                  <div key={r.id} className="border rounded-lg p-3">
                    <div className="flex justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {r.reminder_type === 'whatsapp' && <MessageCircle className="w-4 h-4 text-green-600" />}
                        {r.reminder_type === 'email' && <Mail className="w-4 h-4 text-blue-600" />}
                        {r.reminder_type === 'phone' && <Phone className="w-4 h-4 text-purple-600" />}
                        <span className="font-medium">{r.reminder_type === 'whatsapp' ? 'וואטסאפ' : r.reminder_type === 'email' ? 'מייל' : 'טלפון'}</span>
                      </div>
                      <span className="text-sm text-gray-500">{new Date(r.sent_at).toLocaleDateString('he-IL')}</span>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{r.message}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setShowHistoryModal(false)}>סגור</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* מודל סטטוס גבייה */}
      <Modal isOpen={showNotesModal} onClose={() => setShowNotesModal(false)} title="עדכון סטטוס גבייה">
        {selectedItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium">{selectedItem.customer?.name}</p>
              <p className="text-sm text-gray-500">חשבונית {selectedItem.invoice_number || '-'} | {formatCurrency(selectedItem.amount)}</p>
            </div>

            <Select label="סטטוס" options={collectionStatuses.map(s => ({ value: s.value, label: s.label }))}
              value={notesData.collection_status} onChange={(e) => setNotesData(p => ({ ...p, collection_status: e.target.value }))} />

            {notesData.collection_status === 'promised' && (
              <Input label="תאריך שהבטיח" type="date" value={notesData.promised_date}
                onChange={(e) => setNotesData(p => ({ ...p, promised_date: e.target.value }))} />
            )}

            <textarea className="w-full h-24 p-3 border rounded-lg text-sm" value={notesData.collection_notes}
              onChange={(e) => setNotesData(p => ({ ...p, collection_notes: e.target.value }))} placeholder="הערות..." dir="rtl" />

            <div className="flex gap-3 pt-4 border-t">
              <Button onClick={saveNotes}><Check className="w-4 h-4" />שמור</Button>
              <Button variant="outline" onClick={() => setShowNotesModal(false)}>ביטול</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* מודל תשלום */}
      <Modal isOpen={showPaymentModal} onClose={() => { setShowPaymentModal(false); setSelectedItem(null) }} title="סימון כשולם">
        {selectedItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 flex justify-between items-center">
              <div>
                <p className="font-medium">{selectedItem.customer?.name || '-'}</p>
                <p className="text-sm text-gray-500">
                  חשבונית {selectedItem.invoice_number || '-'}
                  {(selectedItem as any).project_number && <span> | פרויקט {(selectedItem as any).project_number}</span>}
                </p>
              </div>
              <p className="text-2xl font-bold text-primary-600">{formatCurrency(selectedItem.amount)}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input label="תאריך תשלום" type="date" value={paymentData.payment_date}
                onChange={(e) => setPaymentData(p => ({ ...p, payment_date: e.target.value }))} />

              <Select label="אמצעי תשלום" options={[
                { value: '', label: 'בחר' },
                { value: 'bank_transfer', label: 'העברה בנקאית' },
                { value: 'credit_card', label: 'כרטיס אשראי' },
                { value: 'cash', label: 'מזומן' },
                { value: 'check', label: 'צ׳ק' },
                { value: 'bit', label: 'ביט' },
              ]} value={paymentData.payment_method} onChange={(e) => setPaymentData(p => ({ ...p, payment_method: e.target.value }))} />
            </div>

            <Input 
              label="מספר פרויקט/עבודה" 
              placeholder="לדוגמה: 2024-001"
              value={paymentData.project_number}
              onChange={(e) => setPaymentData(p => ({ ...p, project_number: e.target.value }))} 
            />

            <Input 
              label="מספר חשבונית מס קבלה" 
              placeholder="מספר הקבלה שהונפקה"
              value={paymentData.receipt_number}
              onChange={(e) => setPaymentData(p => ({ ...p, receipt_number: e.target.value }))} 
            />

            <Input 
              label="שם מי ששילם בפועל (אם שונה מהלקוח)" 
              placeholder="השאר ריק אם הלקוח עצמו שילם"
              value={paymentData.actual_payer_name}
              onChange={(e) => setPaymentData(p => ({ ...p, actual_payer_name: e.target.value }))} 
            />

            <div className="flex gap-3 pt-4">
              <Button onClick={markAsPaid}><Check className="w-4 h-4" />אשר</Button>
              <Button variant="outline" onClick={() => setShowPaymentModal(false)}>ביטול</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
