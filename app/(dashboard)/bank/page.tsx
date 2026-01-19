'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { ExcelImport } from '@/components/import/ExcelImport'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDateShort, cn } from '@/lib/utils'
import { 
  Upload, Search, ArrowUpCircle, ArrowDownCircle, Link2, 
  ArrowLeftRight, Tag, Repeat, Edit2, Check, RefreshCw,
  Home, User, Building, CreditCard, FileText, Landmark, CircleDollarSign
} from 'lucide-react'
import { Select } from '@/components/ui/Select'
import type { BankTransaction, Category } from '@/types'

const transactionTypes = [
  { value: 'regular', label: 'רגיל', icon: CircleDollarSign, color: 'gray' },
  { value: 'loan_payment', label: 'הלוואה', icon: Home, color: 'purple' },
  { value: 'owner_withdrawal', label: 'משיכת בעלים', icon: User, color: 'orange' },
  { value: 'owner_deposit', label: 'הפקדת בעלים', icon: User, color: 'green' },
  { value: 'bank_fee', label: 'עמלת בנק', icon: Building, color: 'red' },
  { value: 'tax_payment', label: 'מס הכנסה', icon: FileText, color: 'blue' },
  { value: 'vat_payment', label: 'מע״מ', icon: FileText, color: 'blue' },
  { value: 'social_security', label: 'ביטוח לאומי', icon: Landmark, color: 'teal' },
  { value: 'salary', label: 'משכורות', icon: CreditCard, color: 'indigo' },
  { value: 'transfer_between', label: 'העברה בין חשבונות', icon: ArrowLeftRight, color: 'gray' },
  { value: 'other', label: 'אחר', icon: Tag, color: 'gray' },
]

const getTransactionType = (type: string) => transactionTypes.find(t => t.value === type) || transactionTypes[0]

interface ExtendedBankTransaction extends BankTransaction {
  transaction_type?: string
  is_recurring?: boolean
  recurring_label?: string
  notes?: string
}

export default function BankPage() {
  const [transactions, setTransactions] = useState<ExtendedBankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<ExtendedBankTransaction | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterMatched, setFilterMatched] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [editData, setEditData] = useState({
    transaction_type: 'regular',
    is_recurring: false,
    recurring_label: '',
    notes: '',
  })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)

      const { data: transactionsData } = await supabase
        .from('bank_transactions')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('date', { ascending: false })

      setTransactions(transactionsData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async (data: Record<string, any>[]) => {
    if (!companyId) return

    const batchId = crypto.randomUUID()
    const records = data.map(row => ({
      company_id: companyId,
      bank_name: row.bank_name || null,
      account_number: row.account_number || null,
      date: row.date || new Date().toISOString().split('T')[0],
      amount: parseFloat(row.amount) || 0,
      description: row.description || null,
      balance: row.balance ? parseFloat(row.balance) : null,
      import_batch_id: batchId,
    }))

    const { error } = await supabase.from('bank_transactions').insert(records)
    if (error) throw error

    setSuccessMessage(`יובאו ${records.length} תנועות בהצלחה!`)
    loadData()
  }

  const openEditModal = (transaction: ExtendedBankTransaction) => {
    setSelectedTransaction(transaction)
    setEditData({
      transaction_type: transaction.transaction_type || 'regular',
      is_recurring: transaction.is_recurring || false,
      recurring_label: transaction.recurring_label || '',
      notes: transaction.notes || '',
    })
    setShowEditModal(true)
  }

  const saveTransaction = async () => {
    if (!selectedTransaction) return
    try {
      await supabase.from('bank_transactions').update({
        transaction_type: editData.transaction_type,
        is_recurring: editData.is_recurring,
        recurring_label: editData.recurring_label || null,
        notes: editData.notes || null,
      }).eq('id', selectedTransaction.id)

      setShowEditModal(false)
      setSelectedTransaction(null)
      setSuccessMessage('התנועה עודכנה בהצלחה!')
      loadData()
    } catch (error) {
      console.error('Error saving transaction:', error)
    }
  }

  const findSimilarTransactions = (transaction: ExtendedBankTransaction) => {
    return transactions.filter(t => 
      t.id !== transaction.id &&
      t.description === transaction.description &&
      Math.abs(t.amount - transaction.amount) < 1
    )
  }

  const applyToSimilar = async () => {
    if (!selectedTransaction) return
    const similar = findSimilarTransactions(selectedTransaction)
    if (similar.length === 0) return

    try {
      await supabase.from('bank_transactions').update({
        transaction_type: editData.transaction_type,
        is_recurring: true,
        recurring_label: editData.recurring_label || null,
      }).in('id', [...similar.map(s => s.id), selectedTransaction.id])

      setSuccessMessage(`עודכנו ${similar.length + 1} תנועות דומות!`)
      setShowEditModal(false)
      loadData()
    } catch (error) {
      console.error('Error applying to similar:', error)
    }
  }

  const filteredTransactions = transactions.filter(item => {
    const matchesSearch = !searchTerm || item.description?.includes(searchTerm)
    const matchesMonth = !selectedMonth || item.date.startsWith(selectedMonth)
    const matchesType = !filterType || item.transaction_type === filterType
    const matchesMatched = !filterMatched || 
      (filterMatched === 'matched' && item.matched_type) ||
      (filterMatched === 'unmatched' && !item.matched_type)
    return matchesSearch && matchesMonth && matchesType && matchesMatched
  })

  const totalIncome = filteredTransactions.filter(t => t.amount > 0).reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = filteredTransactions.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const currentBalance = transactions[0]?.balance || 0
  const unmatchedCount = transactions.filter(t => !t.matched_type && (!t.transaction_type || t.transaction_type === 'regular')).length
  const specialCount = transactions.filter(t => t.transaction_type && t.transaction_type !== 'regular').length

  const availableMonths = Array.from(new Set(transactions.map(t => t.date.substring(0, 7)))).sort().reverse()
  const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']

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
        title="תנועות בנק"
        description="ייבוא, סיווג והתאמת תנועות בנק"
        actions={
          <div className="flex gap-3">
            <Link href="/reconciliation">
              <Button variant="outline"><ArrowLeftRight className="w-4 h-4" />התאמת תנועות</Button>
            </Link>
            <Button onClick={() => setShowImportModal(true)}><Upload className="w-4 h-4" />ייבוא מאקסל</Button>
          </div>
        }
      />

      {successMessage && <Alert variant="success" onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">יתרה נוכחית</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(currentBalance)}</p>
            </div>
            <div className="p-2 bg-primary-50 rounded-lg"><Link2 className="w-5 h-5 text-primary-600" /></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">זיכויים</p>
              <p className="text-xl font-bold text-success-600">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="p-2 bg-success-50 rounded-lg"><ArrowDownCircle className="w-5 h-5 text-success-600" /></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">חיובים</p>
              <p className="text-xl font-bold text-danger-600">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="p-2 bg-danger-50 rounded-lg"><ArrowUpCircle className="w-5 h-5 text-danger-600" /></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">לא מותאמות</p>
              <p className="text-xl font-bold text-amber-600">{unmatchedCount}</p>
            </div>
            <div className="p-2 bg-amber-50 rounded-lg"><RefreshCw className="w-5 h-5 text-amber-600" /></div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">מסווגות</p>
              <p className="text-xl font-bold text-purple-600">{specialCount}</p>
            </div>
            <div className="p-2 bg-purple-50 rounded-lg"><Tag className="w-5 h-5 text-purple-600" /></div>
          </div>
        </Card>
      </div>

      <Card padding="md">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="חיפוש לפי תיאור..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pr-10" />
          </div>
          <Select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            options={[{ value: '', label: 'כל החודשים' }, ...availableMonths.map(m => {
              const [year, month] = m.split('-')
              return { value: m, label: `${monthNames[parseInt(month) - 1]} ${year}` }
            })]} className="w-40" />
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}
            options={[{ value: '', label: 'כל הסוגים' }, ...transactionTypes.map(t => ({ value: t.value, label: t.label }))]} className="w-40" />
          <Select value={filterMatched} onChange={(e) => setFilterMatched(e.target.value)}
            options={[{ value: '', label: 'הכל' }, { value: 'matched', label: 'מותאמות' }, { value: 'unmatched', label: 'לא מותאמות' }]} className="w-36" />
        </div>
      </Card>

      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>תאריך</TableHead>
              <TableHead>תיאור</TableHead>
              <TableHead>סוג</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>יתרה</TableHead>
              <TableHead>סטטוס</TableHead>
              <TableHead>פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">אין תנועות להצגה</TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((item) => {
                const typeInfo = getTransactionType(item.transaction_type || 'regular')
                const TypeIcon = typeInfo.icon
                const similarCount = findSimilarTransactions(item).length

                return (
                  <TableRow key={item.id} className={cn(item.is_recurring && "bg-purple-50/50")}>
                    <TableCell>{formatDateShort(item.date)}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.description || '-'}</p>
                        {item.recurring_label && (
                          <p className="text-xs text-purple-600 flex items-center gap-1"><Repeat className="w-3 h-3" />{item.recurring_label}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="w-4 h-4 text-gray-500" />
                        <span className="text-sm">{typeInfo.label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn('font-semibold', item.amount >= 0 ? 'text-success-600' : 'text-danger-600')}>
                        {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount)}
                      </span>
                    </TableCell>
                    <TableCell>{item.balance ? formatCurrency(item.balance) : '-'}</TableCell>
                    <TableCell>
                      {item.matched_type ? (
                        <Badge variant="success">{item.matched_type === 'income' ? 'הכנסה' : 'הוצאה'}</Badge>
                      ) : item.transaction_type && item.transaction_type !== 'regular' ? (
                        <Badge variant="purple">מסווג</Badge>
                      ) : (
                        <Badge variant="default">ממתין</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEditModal(item)} title="סיווג"><Edit2 className="w-4 h-4" /></Button>
                        {!item.matched_type && (!item.transaction_type || item.transaction_type === 'regular') && (
                          <Link href="/reconciliation"><Button size="sm" variant="ghost" title="התאם"><ArrowLeftRight className="w-4 h-4" /></Button></Link>
                        )}
                        {similarCount > 0 && !item.is_recurring && <Badge variant="warning" size="sm">{similarCount}</Badge>}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="סיווג תנועה">
        {selectedTransaction && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">{selectedTransaction.description}</p>
                  <p className="text-sm text-gray-500">{formatDateShort(selectedTransaction.date)}</p>
                </div>
                <p className={cn("text-xl font-bold", selectedTransaction.amount >= 0 ? "text-success-600" : "text-danger-600")}>
                  {formatCurrency(selectedTransaction.amount)}
                </p>
              </div>
            </div>

            <Select label="סוג תנועה" options={transactionTypes.map(t => ({ value: t.value, label: t.label }))}
              value={editData.transaction_type} onChange={(e) => setEditData(prev => ({ ...prev, transaction_type: e.target.value }))} />

            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editData.is_recurring}
                onChange={(e) => setEditData(prev => ({ ...prev, is_recurring: e.target.checked }))} className="w-4 h-4 text-primary-600 rounded" />
              <Repeat className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium">תנועה חוזרת</span>
            </label>

            {editData.is_recurring && (
              <Input label="תווית" value={editData.recurring_label}
                onChange={(e) => setEditData(prev => ({ ...prev, recurring_label: e.target.value }))} placeholder="הלוואה לדירה / משכנתא" />
            )}

            <Input label="הערות" value={editData.notes}
              onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))} placeholder="הערות נוספות..." />

            {findSimilarTransactions(selectedTransaction).length > 0 && (
              <Alert variant="info">
                <div className="flex items-center justify-between">
                  <span>נמצאו {findSimilarTransactions(selectedTransaction).length} תנועות דומות</span>
                  <Button size="sm" variant="outline" onClick={applyToSimilar}>החל על כולן</Button>
                </div>
              </Alert>
            )}

            <div className="flex gap-3 pt-4 border-t">
              <Button onClick={saveTransaction}><Check className="w-4 h-4" />שמור</Button>
              <Button variant="outline" onClick={() => setShowEditModal(false)}>ביטול</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} size="xl">
        <ExcelImport type="bank" requiredFields={[
          { key: 'date', label: 'תאריך', required: true },
          { key: 'amount', label: 'סכום', required: true },
          { key: 'description', label: 'תיאור', required: false },
          { key: 'balance', label: 'יתרה', required: false },
          { key: 'bank_name', label: 'שם הבנק', required: false },
          { key: 'account_number', label: 'מספר חשבון', required: false },
        ]} onImport={handleImport} onClose={() => setShowImportModal(false)} />
      </Modal>
    </div>
  )
}
