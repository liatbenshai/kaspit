'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Select'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDateShort, cn } from '@/lib/utils'
import { 
  Clock, AlertTriangle, CheckCircle, Calendar, TrendingUp, 
  Phone, Mail, ChevronDown, ChevronUp, Filter, Check,
  DollarSign, Users, FileText, ArrowRight
} from 'lucide-react'
import type { Income, Customer } from '@/types'

interface CollectionItem extends Income {
  customer?: Customer | null
  days_until_due: number
  days_overdue: number
  is_overdue: boolean
}

interface WeekSummary {
  label: string
  startDate: Date
  endDate: Date
  items: CollectionItem[]
  total: number
}

export default function CollectionPage() {
  const [loading, setLoading] = useState(true)
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [items, setItems] = useState<CollectionItem[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [filterCustomer, setFilterCustomer] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'overdue' | 'upcoming' | 'this_week'>('all')
  const [viewMode, setViewMode] = useState<'list' | 'timeline'>('list')
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set(['week_0', 'week_1']))
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState<CollectionItem | null>(null)
  const [paymentData, setPaymentData] = useState({ payment_date: new Date().toISOString().split('T')[0], payment_method: '' })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      // טעינת הכנסות פתוחות (לא שולמו)
      const { data: incomeData } = await supabase
        .from('income')
        .select('*, customer:customers(*)')
        .eq('company_id', profile.company_id)
        .neq('payment_status', 'paid')
        .in('document_type', ['invoice', 'tax_invoice']) // רק חשבוניות
        .order('due_date', { ascending: true })

      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)

      setCustomers(customersData || [])

      // חישוב ימים עד/אחרי תאריך לתשלום
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

        return {
          ...item,
          days_until_due: daysUntilDue,
          days_overdue: daysOverdue,
          is_overdue: isOverdue,
        }
      })

      setItems(processedItems)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const markAsPaid = async () => {
    if (!selectedItem) return

    try {
      await supabase.from('income').update({
        payment_status: 'paid',
        payment_date: paymentData.payment_date,
        payment_method: paymentData.payment_method || null,
      }).eq('id', selectedItem.id)

      setShowPaymentModal(false)
      setSelectedItem(null)
      setPaymentData({ payment_date: new Date().toISOString().split('T')[0], payment_method: '' })
      loadData()
    } catch (error) {
      console.error('Error marking as paid:', error)
    }
  }

  // סינון
  const filteredItems = items.filter(item => {
    if (filterCustomer && item.customer_id !== filterCustomer) return false
    if (filterStatus === 'overdue' && !item.is_overdue) return false
    if (filterStatus === 'upcoming' && item.is_overdue) return false
    if (filterStatus === 'this_week' && (item.is_overdue || item.days_until_due > 7)) return false
    return true
  })

  // חלוקה לשבועות
  const getWeekSummaries = (): WeekSummary[] => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const weeks: WeekSummary[] = []
    
    // באיחור
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

    // השבוע הנוכחי
    const endOfWeek = new Date(today)
    endOfWeek.setDate(endOfWeek.getDate() + (6 - endOfWeek.getDay()))
    
    const thisWeekItems = filteredItems.filter(i => !i.is_overdue && i.days_until_due <= (6 - today.getDay()))
    if (thisWeekItems.length > 0 || weeks.length === 0) {
      weeks.push({
        label: '📅 השבוע',
        startDate: today,
        endDate: endOfWeek,
        items: thisWeekItems,
        total: thisWeekItems.reduce((sum, i) => sum + i.amount, 0),
      })
    }

    // 4 שבועות קדימה
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

    // מאוחר יותר
    const laterItems = filteredItems.filter(i => {
      if (i.is_overdue || !i.due_date) return false
      return i.days_until_due > 35
    })
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

  // סטטיסטיקות
  const totalOpen = items.reduce((sum, i) => sum + i.amount, 0)
  const totalOverdue = items.filter(i => i.is_overdue).reduce((sum, i) => sum + i.amount, 0)
  const totalThisWeek = items.filter(i => !i.is_overdue && i.days_until_due <= 7).reduce((sum, i) => sum + i.amount, 0)
  const totalNextMonth = items.filter(i => !i.is_overdue && i.days_until_due <= 30).reduce((sum, i) => sum + i.amount, 0)
  const overdueCount = items.filter(i => i.is_overdue).length
  const uniqueCustomers = new Set(items.map(i => i.customer_id)).size

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
      <PageHeader
        title="גבייה ותזרים צפוי"
        description="מעקב חשבוניות פתוחות ותזרים הכנסות צפוי"
      />

      {/* כרטיסי סיכום */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="md" className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-blue-600">סה״כ פתוח</p>
              <p className="text-xl font-bold text-blue-800">{formatCurrency(totalOpen)}</p>
              <p className="text-xs text-blue-600">{items.length} חשבוניות</p>
            </div>
          </div>
        </Card>

        <Card padding="md" className={cn(
          "bg-gradient-to-br border",
          totalOverdue > 0 
            ? "from-red-50 to-red-100 border-red-200" 
            : "from-green-50 to-green-100 border-green-200"
        )}>
          <div className="flex items-center gap-3">
            <div className={cn("p-2 rounded-lg", totalOverdue > 0 ? "bg-red-500" : "bg-green-500")}>
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className={cn("text-sm", totalOverdue > 0 ? "text-red-600" : "text-green-600")}>באיחור</p>
              <p className={cn("text-xl font-bold", totalOverdue > 0 ? "text-red-800" : "text-green-800")}>
                {formatCurrency(totalOverdue)}
              </p>
              <p className={cn("text-xs", totalOverdue > 0 ? "text-red-600" : "text-green-600")}>
                {overdueCount} חשבוניות
              </p>
            </div>
          </div>
        </Card>

        <Card padding="md" className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 rounded-lg">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-amber-600">צפוי השבוע</p>
              <p className="text-xl font-bold text-amber-800">{formatCurrency(totalThisWeek)}</p>
            </div>
          </div>
        </Card>

        <Card padding="md" className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500 rounded-lg">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-purple-600">צפוי החודש</p>
              <p className="text-xl font-bold text-purple-800">{formatCurrency(totalNextMonth)}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* סרגל סינון */}
      <Card padding="md">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">סינון:</span>
          </div>
          
          <Select
            options={[
              { value: 'all', label: 'כל החשבוניות' },
              { value: 'overdue', label: '⚠️ באיחור בלבד' },
              { value: 'this_week', label: '📅 השבוע בלבד' },
              { value: 'upcoming', label: '📆 עתידיות בלבד' },
            ]}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="w-40"
          />

          <Select
            options={[
              { value: '', label: 'כל הלקוחות' },
              ...customers.map(c => ({ value: c.id, label: c.name }))
            ]}
            value={filterCustomer}
            onChange={(e) => setFilterCustomer(e.target.value)}
            className="w-48"
          />

          <div className="flex-1" />

          <div className="flex gap-2">
            <Button
              variant={viewMode === 'list' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              רשימה
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setViewMode('timeline')}
            >
              ציר זמן
            </Button>
          </div>
        </div>
      </Card>

      {/* תצוגת ציר זמן */}
      {viewMode === 'timeline' && (
        <div className="space-y-4">
          {weeks.map((week, weekIndex) => {
            const weekId = `week_${weekIndex}`
            const isExpanded = expandedWeeks.has(weekId)
            const isOverdueWeek = week.label.includes('באיחור')

            return (
              <Card key={weekId} padding="none" className={cn(
                isOverdueWeek && "border-red-300 bg-red-50/50"
              )}>
                <button
                  onClick={() => toggleWeek(weekId)}
                  className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-medium">{week.label}</span>
                    <Badge variant={isOverdueWeek ? 'danger' : 'default'}>
                      {week.items.length} חשבוניות
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={cn(
                      "text-xl font-bold",
                      isOverdueWeek ? "text-red-600" : "text-gray-800"
                    )}>
                      {formatCurrency(week.total)}
                    </span>
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
                          <TableHead>תאריך לתשלום</TableHead>
                          <TableHead>סטטוס</TableHead>
                          <TableHead>סכום</TableHead>
                          <TableHead>פעולות</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {week.items.map(item => (
                          <TableRow key={item.id} className={cn(
                            item.is_overdue && "bg-red-50"
                          )}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{item.customer?.name || 'לא משויך'}</p>
                                {item.customer?.phone && (
                                  <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Phone className="w-3 h-3" />
                                    {item.customer.phone}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-mono">{item.invoice_number || '-'}</TableCell>
                            <TableCell>
                              <div>
                                <p>{item.due_date ? formatDateShort(item.due_date) : 'לא הוגדר'}</p>
                                {item.is_overdue && (
                                  <p className="text-xs text-red-600 font-medium">
                                    {item.days_overdue} ימים באיחור
                                  </p>
                                )}
                                {!item.is_overdue && item.days_until_due === 0 && (
                                  <p className="text-xs text-amber-600 font-medium">היום!</p>
                                )}
                                {!item.is_overdue && item.days_until_due > 0 && item.days_until_due <= 3 && (
                                  <p className="text-xs text-amber-600">בעוד {item.days_until_due} ימים</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              {item.is_overdue ? (
                                <Badge variant="danger">באיחור</Badge>
                              ) : item.days_until_due <= 3 ? (
                                <Badge variant="warning">בקרוב</Badge>
                              ) : (
                                <Badge variant="default">ממתין</Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-bold text-lg">{formatCurrency(item.amount)}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedItem(item)
                                  setShowPaymentModal(true)
                                }}
                              >
                                <Check className="w-4 h-4" />
                                שולם
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {isExpanded && week.items.length === 0 && (
                  <div className="p-8 text-center text-gray-500 border-t">
                    אין חשבוניות לתקופה זו
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* תצוגת רשימה */}
      {viewMode === 'list' && (
        <Card padding="none">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>לקוח</TableHead>
                <TableHead>סוג מסמך</TableHead>
                <TableHead>מס׳</TableHead>
                <TableHead>תאריך הנפקה</TableHead>
                <TableHead>תאריך לתשלום</TableHead>
                <TableHead>סטטוס</TableHead>
                <TableHead>סכום</TableHead>
                <TableHead>פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">אין חשבוניות פתוחות!</p>
                    <p className="text-sm text-gray-500">כל החשבוניות שולמו 🎉</p>
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map(item => (
                  <TableRow key={item.id} className={cn(
                    item.is_overdue && "bg-red-50"
                  )}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.customer?.name || 'לא משויך'}</p>
                        {item.customer?.email && (
                          <p className="text-xs text-gray-500">{item.customer.email}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        {item.document_type === 'invoice' ? 'חשבונית עסקה' : 'חשבונית מס'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">{item.invoice_number || '-'}</TableCell>
                    <TableCell>{formatDateShort(item.date)}</TableCell>
                    <TableCell>
                      <div>
                        <p>{item.due_date ? formatDateShort(item.due_date) : '-'}</p>
                        {item.is_overdue && (
                          <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {item.days_overdue} ימים
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {item.is_overdue ? (
                        <Badge variant="danger">באיחור</Badge>
                      ) : item.days_until_due === 0 ? (
                        <Badge variant="warning">היום</Badge>
                      ) : item.days_until_due <= 7 ? (
                        <Badge variant="warning">השבוע</Badge>
                      ) : (
                        <Badge variant="default">ממתין</Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-bold">{formatCurrency(item.amount)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedItem(item)
                          setShowPaymentModal(true)
                        }}
                      >
                        <Check className="w-4 h-4" />
                        שולם
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* מודל סימון כשולם */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false)
          setSelectedItem(null)
        }}
        title="סימון חשבונית כשולמה"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{selectedItem.customer?.name || 'לא משויך'}</p>
                  <p className="text-sm text-gray-500">חשבונית {selectedItem.invoice_number || '-'}</p>
                </div>
                <p className="text-2xl font-bold text-primary-600">{formatCurrency(selectedItem.amount)}</p>
              </div>
            </div>

            <Input
              label="תאריך תשלום"
              type="date"
              value={paymentData.payment_date}
              onChange={(e) => setPaymentData(prev => ({ ...prev, payment_date: e.target.value }))}
            />

            <Select
              label="אמצעי תשלום"
              options={[
                { value: '', label: 'בחר אמצעי תשלום' },
                { value: 'bank_transfer', label: 'העברה בנקאית' },
                { value: 'credit_card', label: 'כרטיס אשראי' },
                { value: 'cash', label: 'מזומן' },
                { value: 'check', label: 'צ׳ק' },
                { value: 'bit', label: 'ביט / פייבוקס' },
              ]}
              value={paymentData.payment_method}
              onChange={(e) => setPaymentData(prev => ({ ...prev, payment_method: e.target.value }))}
            />

            <div className="flex gap-3 pt-4">
              <Button onClick={markAsPaid}>
                <Check className="w-4 h-4" />
                אשר תשלום
              </Button>
              <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                ביטול
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
