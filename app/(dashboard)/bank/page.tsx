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
import { Upload, Search, ArrowLeftRight, Tag, Repeat, Edit2, Check, RefreshCw, Home, User, Building, CreditCard, FileText, Landmark, CircleDollarSign, Zap, Droplets, Building2, Percent, CheckSquare, Square, Banknote, FileCheck, Shield, Sparkles } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import type { BankTransaction } from '@/types'

// ==========================================
// סוגי תנועות מורחב
// ==========================================
const transactionTypes = [
  { value: 'regular', label: 'רגיל (להתאמה)', icon: CircleDollarSign, color: 'gray' },
  { value: 'vat_payment', label: 'מע״מ', icon: FileText, color: 'blue' },
  { value: 'tax_payment', label: 'מס הכנסה', icon: FileText, color: 'blue' },
  { value: 'social_security', label: 'ביטוח לאומי', icon: Landmark, color: 'teal' },
  { value: 'arnona', label: 'ארנונה', icon: Building2, color: 'amber' },
  { value: 'electricity', label: 'חשמל', icon: Zap, color: 'yellow' },
  { value: 'water', label: 'מים', icon: Droplets, color: 'cyan' },
  { value: 'gas', label: 'גז', icon: Zap, color: 'orange' },
  { value: 'vaad_bayit', label: 'ועד בית', icon: Building, color: 'stone' },
  { value: 'rent', label: 'שכירות', icon: Home, color: 'violet' },
  { value: 'insurance', label: 'ביטוח', icon: Shield, color: 'emerald' },
  { value: 'loan_payment', label: 'הלוואה', icon: Home, color: 'purple' },
  { value: 'bank_fee', label: 'עמלת בנק', icon: Building, color: 'red' },
  { value: 'interest_credit', label: 'ריבית זכות', icon: Percent, color: 'green' },
  { value: 'interest_debit', label: 'ריבית חובה', icon: Percent, color: 'red' },
  { value: 'check_deposited', label: 'צ׳ק שהופקד', icon: FileCheck, color: 'blue' },
  { value: 'check_outgoing', label: 'צ׳ק יוצא', icon: FileText, color: 'orange' },
  { value: 'cash_deposit', label: 'הפקדת מזומן', icon: Banknote, color: 'green' },
  { value: 'cash_withdrawal', label: 'משיכת מזומן', icon: Banknote, color: 'orange' },
  { value: 'credit_card_clearing', label: 'סליקת אשראי', icon: CreditCard, color: 'purple' },
  { value: 'salary', label: 'משכורות', icon: CreditCard, color: 'indigo' },
  { value: 'owner_withdrawal', label: 'משיכת בעלים', icon: User, color: 'orange' },
  { value: 'owner_deposit', label: 'הפקדת בעלים', icon: User, color: 'green' },
  { value: 'transfer_between', label: 'העברה בין חשבונות', icon: ArrowLeftRight, color: 'gray' },
  { value: 'other', label: 'אחר', icon: Tag, color: 'gray' },
]

const getTransactionType = (type: string) => transactionTypes.find(t => t.value === type) || transactionTypes[0]

// ==========================================
// זיהוי אוטומטי של סוג תנועה
// ==========================================
const autoDetectTransactionType = (description: string, amount: number): string => {
  if (!description) return 'regular'
  const desc = description.toLowerCase()
  
  if (desc.includes('מע"מ') || desc.includes('מס ערך מוסף') || desc.includes('מעמ')) return 'vat_payment'
  if (desc.includes('מס הכנסה') || desc.includes('פקיד שומה')) return 'tax_payment'
  if (desc.includes('ביטוח לאומי') || desc.includes('בל"ל') || desc.includes('המוסד לביטוח')) return 'social_security'
  if (desc.includes('ארנונה') || desc.includes('עירית') || desc.includes('עיריית') || desc.includes('מועצה')) return 'arnona'
  if (desc.includes('חברת החשמל') || desc.includes('חח"י')) return 'electricity'
  if (desc.includes('מי ') || desc.includes('מקורות') || desc.includes('תאגיד מים')) return 'water'
  if (desc.includes('פזגז') || desc.includes('סופרגז') || desc.includes('אמישראגז')) return 'gas'
  if (desc.includes('ועד') || desc.includes('דמי ניהול בניין')) return 'vaad_bayit'
  if (desc.includes('שכירות') || desc.includes('שכ"ד')) return 'rent'
  if (desc.includes('הראל') || desc.includes('מגדל') || desc.includes('כלל ביטוח') || desc.includes('הפניקס') || desc.includes('ביטוח')) return 'insurance'
  if (desc.includes('הלוואה') || desc.includes('משכנתא')) return 'loan_payment'
  if (desc.includes('עמלה') || desc.includes('דמי ניהול')) return 'bank_fee'
  if (desc.includes('ריבית')) return amount > 0 ? 'interest_credit' : 'interest_debit'
  if (desc.includes('ישראכרט') || desc.includes('כאל') || desc.includes('מקס') || desc.includes('לאומי קארד') || desc.includes('אמריקן')) return 'credit_card_clearing'
  if (desc.includes('שיק') || desc.includes('צ\'ק') || desc.includes('צק') || desc.includes('המחאה')) return amount > 0 ? 'check_deposited' : 'check_outgoing'
  if (desc.includes('משכורת') || desc.includes('שכר')) return 'salary'
  if (desc.includes('העברה פנימית') || desc.includes('העברה בין')) return 'transfer_between'
  
  return 'regular'
}

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
  const [showBulkEditModal, setShowBulkEditModal] = useState(false)
  const [selectedTransaction, setSelectedTransaction] = useState<ExtendedBankTransaction | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterMatched, setFilterMatched] = useState<string>('')
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkEditData, setBulkEditData] = useState({ transaction_type: '', is_recurring: false, recurring_label: '' })
  const [editData, setEditData] = useState({ transaction_type: 'regular', is_recurring: false, recurring_label: '', notes: '' })

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase.from('users').select('company_id').eq('id', user.id).single()
      if (!profile?.company_id) return
      setCompanyId(profile.company_id)
      const { data: transactionsData } = await supabase.from('bank_transactions').select('*').eq('company_id', profile.company_id).order('date', { ascending: false })
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
    const classifiedTransactions = transactions.filter(t => t.transaction_type && t.transaction_type !== 'regular')
    
    const findMatchingClassification = (description: string, amount: number) => {
      const match = classifiedTransactions.find(t => t.description === description && Math.abs(t.amount - amount) < 1)
      if (match) return { transaction_type: match.transaction_type, is_recurring: match.is_recurring, recurring_label: match.recurring_label }
      return null
    }

    let autoClassifiedCount = 0
    const records = data.map(row => {
      const description = row.description || row['תיאור'] || null
      const amount = parseFloat(row.amount || row['סכום']) || 0
      let classification = description ? findMatchingClassification(description, amount) : null
      if (!classification && description) {
        const detectedType = autoDetectTransactionType(description, amount)
        if (detectedType !== 'regular') {
          classification = { transaction_type: detectedType, is_recurring: false, recurring_label: '' }
        }
      }
      if (classification) autoClassifiedCount++
      
      return {
        company_id: companyId, bank_name: row.bank_name || row['שם הבנק'] || null,
        account_number: row.account_number || row['מספר חשבון'] || null,
        date: row.date || row['תאריך'] || new Date().toISOString().split('T')[0],
        amount, description,
        balance: row.balance || row['יתרה'] ? parseFloat(row.balance || row['יתרה']) : null,
        import_batch_id: batchId,
        transaction_type: classification?.transaction_type || 'regular',
        is_recurring: classification?.is_recurring || false,
        recurring_label: classification?.recurring_label || undefined,
      }
    })

    const { error } = await supabase.from('bank_transactions').insert(records)
    if (error) throw error
    setSuccessMessage(`יובאו ${records.length} תנועות!` + (autoClassifiedCount > 0 ? ` (${autoClassifiedCount} סווגו אוטומטית)` : ''))
    loadData()
  }

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => { const newSet = new Set(prev); if (newSet.has(id)) newSet.delete(id); else newSet.add(id); return newSet })
  }
  const toggleSelectAll = () => { if (selectedIds.size === filteredTransactions.length) setSelectedIds(new Set()); else setSelectedIds(new Set(filteredTransactions.map(t => t.id))) }
  const clearSelection = () => setSelectedIds(new Set())

  const handleBulkUpdate = async () => {
    if (selectedIds.size === 0 || !bulkEditData.transaction_type) return
    try {
      await supabase.from('bank_transactions').update({ transaction_type: bulkEditData.transaction_type, is_recurring: bulkEditData.is_recurring, recurring_label: bulkEditData.recurring_label || null }).in('id', Array.from(selectedIds))
      setSuccessMessage(`סווגו ${selectedIds.size} תנועות!`)
      setShowBulkEditModal(false); setBulkEditData({ transaction_type: '', is_recurring: false, recurring_label: '' }); clearSelection(); loadData()
    } catch (err: any) { setError(`שגיאה: ${err.message}`) }
  }

  const autoClassifyUnmatched = async () => {
    const unclassified = transactions.filter(t => !t.matched_type && (!t.transaction_type || t.transaction_type === 'regular'))
    if (unclassified.length === 0) { setSuccessMessage('אין תנועות לסיווג'); return }
    let count = 0
    for (const trans of unclassified) {
      const detectedType = autoDetectTransactionType(trans.description || '', trans.amount)
      if (detectedType !== 'regular') {
        await supabase.from('bank_transactions').update({ transaction_type: detectedType }).eq('id', trans.id)
        count++
      }
    }
    setSuccessMessage(count > 0 ? `סווגו ${count} תנועות אוטומטית!` : 'לא זוהו תנועות לסיווג')
    loadData()
  }

  const openEditModal = (transaction: ExtendedBankTransaction) => {
    setSelectedTransaction(transaction)
    setEditData({ transaction_type: transaction.transaction_type || 'regular', is_recurring: transaction.is_recurring || false, recurring_label: transaction.recurring_label || '', notes: transaction.notes || '' })
    setShowEditModal(true)
  }

  const saveTransaction = async () => {
    if (!selectedTransaction) return
    try {
      const { error } = await supabase.from('bank_transactions').update({ 
        transaction_type: editData.transaction_type, 
        is_recurring: editData.is_recurring, 
        recurring_label: editData.recurring_label || null, 
        notes: editData.notes || null 
      }).eq('id', selectedTransaction.id)
      
      if (error) {
        console.error('Error saving:', error)
        setError(`שגיאה בשמירה: ${error.message}`)
        return
      }
      
      setShowEditModal(false)
      setSelectedTransaction(null)
      setSuccessMessage('עודכן בהצלחה!')
      loadData()
    } catch (err: any) {
      console.error('Error:', err)
      setError(`שגיאה: ${err.message}`)
    }
  }

  const findSimilarTransactions = (transaction: ExtendedBankTransaction) => transactions.filter(t => t.id !== transaction.id && t.description === transaction.description && Math.abs(t.amount - transaction.amount) < 1 && (!t.transaction_type || t.transaction_type === 'regular'))

  const applyToSimilar = async () => {
    if (!selectedTransaction) return
    const ids = findSimilarTransactions(selectedTransaction).map(t => t.id)
    await supabase.from('bank_transactions').update({ transaction_type: editData.transaction_type, is_recurring: editData.is_recurring, recurring_label: editData.recurring_label || null }).in('id', [...ids, selectedTransaction.id])
    setSuccessMessage(`עודכנו ${ids.length + 1} תנועות!`); setShowEditModal(false); loadData()
  }

  const filteredTransactions = transactions.filter(item => {
    const matchesSearch = !searchTerm || item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesMonth = !selectedMonth || item.date.startsWith(selectedMonth)
    const matchesType = !filterType || item.transaction_type === filterType
    const matchesMatched = !filterMatched || (filterMatched === 'matched' && item.matched_type) || (filterMatched === 'unmatched' && !item.matched_type && (!item.transaction_type || item.transaction_type === 'regular')) || (filterMatched === 'classified' && item.transaction_type && item.transaction_type !== 'regular' && !item.matched_type)
    return matchesSearch && matchesMonth && matchesType && matchesMatched
  })

  const availableMonths = Array.from(new Set(transactions.map(t => t.date.substring(0, 7)))).sort().reverse()
  const monthNames = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  const matchedCount = transactions.filter(t => t.matched_type).length
  const classifiedCount = transactions.filter(t => t.transaction_type && t.transaction_type !== 'regular' && !t.matched_type).length
  const unmatchedCount = transactions.filter(t => !t.matched_type && (!t.transaction_type || t.transaction_type === 'regular')).length

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="space-y-6">
      <PageHeader title="תנועות בנק" description="ייבוא, סיווג והתאמת תנועות"
        actions={<div className="flex gap-3">
          <Button variant="outline" onClick={autoClassifyUnmatched}><Sparkles className="w-4 h-4" />סיווג אוטומטי</Button>
          <Button variant="outline" onClick={() => setShowImportModal(true)}><Upload className="w-4 h-4" />ייבוא</Button>
        </div>} />

      {error && <Alert variant="danger" onClose={() => setError(null)}>{error}</Alert>}
      {successMessage && <Alert variant="success" onClose={() => setSuccessMessage(null)}>{successMessage}</Alert>}

      {selectedIds.size > 0 && (
        <Card padding="md" className="bg-primary-50 border-primary-200">
          <div className="flex items-center justify-between">
            <span className="font-medium">נבחרו {selectedIds.size} תנועות</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setShowBulkEditModal(true)}>סווג נבחרות</Button>
              <Button size="sm" variant="outline" onClick={clearSelection}>ביטול</Button>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card padding="md"><p className="text-sm text-gray-500">סה״כ תנועות</p><p className="text-xl font-bold">{transactions.length}</p></Card>
        <Card padding="md"><p className="text-sm text-success-600">מותאמות להכנסה/הוצאה</p><p className="text-xl font-bold text-success-600">{matchedCount}</p></Card>
        <Card padding="md"><p className="text-sm text-purple-600">מסווגות (מע״מ, הלוואה...)</p><p className="text-xl font-bold text-purple-600">{classifiedCount}</p></Card>
        <Card padding="md"><p className="text-sm text-amber-600">ממתינות לטיפול</p><p className="text-xl font-bold text-amber-600">{unmatchedCount}</p></Card>
      </div>

      <Card padding="md">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="חיפוש..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pr-10" />
          </div>
          <Select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} options={[{ value: '', label: 'כל החודשים' }, ...availableMonths.map(m => { const [y, mo] = m.split('-'); return { value: m, label: `${monthNames[parseInt(mo) - 1]} ${y}` } })]} className="w-40" />
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} options={[{ value: '', label: 'כל הסוגים' }, ...transactionTypes.map(t => ({ value: t.value, label: t.label }))]} className="w-44" />
          <Select value={filterMatched} onChange={(e) => setFilterMatched(e.target.value)} options={[{ value: '', label: 'כל הסטטוסים' }, { value: 'matched', label: 'מותאמות' }, { value: 'classified', label: 'מסווגות' }, { value: 'unmatched', label: 'ממתינות' }]} className="w-36" />
        </div>
      </Card>

      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"><button onClick={toggleSelectAll} className="p-1 hover:bg-gray-100 rounded">{selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0 ? <CheckSquare className="w-5 h-5 text-primary-600" /> : <Square className="w-5 h-5 text-gray-400" />}</button></TableHead>
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
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-gray-500">אין תנועות</TableCell></TableRow>
            ) : filteredTransactions.map((item) => {
              const typeInfo = getTransactionType(item.transaction_type || 'regular')
              const TypeIcon = typeInfo.icon
              const similarCount = findSimilarTransactions(item).length
              return (
                <TableRow key={item.id} className={cn(item.is_recurring && "bg-purple-50/50", selectedIds.has(item.id) && "bg-primary-50")}>
                  <TableCell><button onClick={() => toggleSelectItem(item.id)} className="p-1 hover:bg-gray-100 rounded">{selectedIds.has(item.id) ? <CheckSquare className="w-5 h-5 text-primary-600" /> : <Square className="w-5 h-5 text-gray-400" />}</button></TableCell>
                  <TableCell>{formatDateShort(item.date)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.description || '-'}</p>
                      {item.recurring_label && <p className="text-xs text-purple-600 flex items-center gap-1"><Repeat className="w-3 h-3" />{item.recurring_label}</p>}
                    </div>
                  </TableCell>
                  <TableCell><div className="flex items-center gap-2"><TypeIcon className="w-4 h-4 text-gray-500" /><span className="text-sm">{typeInfo.label}</span></div></TableCell>
                  <TableCell><span className={cn('font-semibold', item.amount >= 0 ? 'text-success-600' : 'text-danger-600')}>{item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount)}</span></TableCell>
                  <TableCell>{item.balance ? formatCurrency(item.balance) : '-'}</TableCell>
                  <TableCell>
                    {item.matched_type ? <Badge variant="success">{item.matched_type === 'income' ? 'הכנסה' : 'הוצאה'}</Badge>
                    : item.transaction_type && item.transaction_type !== 'regular' ? <Badge variant="info">מסווג</Badge>
                    : <Badge variant="default">ממתין</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => openEditModal(item)} title="סיווג"><Edit2 className="w-4 h-4" /></Button>
                      {!item.matched_type && (!item.transaction_type || item.transaction_type === 'regular') && <Link href="/reconciliation"><Button size="sm" variant="ghost" title="התאם"><ArrowLeftRight className="w-4 h-4" /></Button></Link>}
                      {similarCount > 0 && !item.is_recurring && <Badge variant="warning" size="sm">{similarCount} דומות</Badge>}
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>

      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="סיווג תנועה">
        {selectedTransaction && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center">
                <div><p className="font-medium">{selectedTransaction.description}</p><p className="text-sm text-gray-500">{formatDateShort(selectedTransaction.date)}</p></div>
                <p className={cn("text-xl font-bold", selectedTransaction.amount >= 0 ? "text-success-600" : "text-danger-600")}>{formatCurrency(selectedTransaction.amount)}</p>
              </div>
            </div>
            <Select label="סוג תנועה" options={transactionTypes.map(t => ({ value: t.value, label: t.label }))} value={editData.transaction_type} onChange={(e) => setEditData(prev => ({ ...prev, transaction_type: e.target.value }))} />
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={editData.is_recurring} onChange={(e) => setEditData(prev => ({ ...prev, is_recurring: e.target.checked }))} className="w-4 h-4 text-primary-600 rounded" />
              <Repeat className="w-4 h-4 text-purple-600" /><span className="text-sm font-medium">תנועה חוזרת</span>
            </label>
            {editData.is_recurring && <Input label="תווית" value={editData.recurring_label} onChange={(e) => setEditData(prev => ({ ...prev, recurring_label: e.target.value }))} placeholder="הלוואה / משכנתא / שכירות" />}
            <Input label="הערות" value={editData.notes} onChange={(e) => setEditData(prev => ({ ...prev, notes: e.target.value }))} />
            {findSimilarTransactions(selectedTransaction).length > 0 && (
              <Alert variant="info"><div className="flex items-center justify-between"><span>נמצאו {findSimilarTransactions(selectedTransaction).length} תנועות דומות</span><Button size="sm" variant="outline" onClick={applyToSimilar}>החל על כולן</Button></div></Alert>
            )}
            <div className="flex gap-3 pt-4 border-t">
              <Button onClick={saveTransaction}><Check className="w-4 h-4" />שמור</Button>
              <Button variant="outline" onClick={() => setShowEditModal(false)}>ביטול</Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showBulkEditModal} onClose={() => setShowBulkEditModal(false)} title={`סיווג ${selectedIds.size} תנועות`}>
        <div className="space-y-4">
          <Select label="סוג תנועה" options={[{ value: '', label: 'בחר סוג...' }, ...transactionTypes.map(t => ({ value: t.value, label: t.label }))]} value={bulkEditData.transaction_type} onChange={(e) => setBulkEditData(prev => ({ ...prev, transaction_type: e.target.value }))} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={bulkEditData.is_recurring} onChange={(e) => setBulkEditData(prev => ({ ...prev, is_recurring: e.target.checked }))} className="w-4 h-4 rounded" />
            <span className="text-sm">תנועה חוזרת</span>
          </label>
          {bulkEditData.is_recurring && <Input label="תווית" value={bulkEditData.recurring_label} onChange={(e) => setBulkEditData(prev => ({ ...prev, recurring_label: e.target.value }))} />}
          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={handleBulkUpdate} disabled={!bulkEditData.transaction_type}><Check className="w-4 h-4" />סווג {selectedIds.size} תנועות</Button>
            <Button variant="outline" onClick={() => setShowBulkEditModal(false)}>ביטול</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showImportModal} onClose={() => setShowImportModal(false)} size="xl">
        <ExcelImport type="bank" requiredFields={[
          { key: 'date', label: 'תאריך', required: true },
          { key: 'amount', label: 'סכום', required: true },
          { key: 'description', label: 'תיאור', required: false },
          { key: 'balance', label: 'יתרה', required: false },
        ]} onImport={handleImport} onClose={() => setShowImportModal(false)} />
      </Modal>
    </div>
  )
}
