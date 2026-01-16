'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/Table'
import { ExcelImport } from '@/components/import/ExcelImport'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDateShort, cn } from '@/lib/utils'
import { Upload, Search, ArrowUpCircle, ArrowDownCircle, Link2, Calendar, ArrowLeftRight } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import type { BankTransaction } from '@/types'

export default function BankPage() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>('')

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

    // Log import
    await supabase.from('import_logs').insert({
      company_id: companyId,
      type: 'bank',
      records_count: records.length,
      status: 'completed',
    })

    loadData()
  }

  const filteredTransactions = transactions.filter(item => {
    const matchesSearch = !searchTerm || item.description?.includes(searchTerm)
    const matchesMonth = !selectedMonth || item.date.startsWith(selectedMonth)
    return matchesSearch && matchesMonth
  })

  const totalIncome = filteredTransactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)
  
  const totalExpenses = filteredTransactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  const currentBalance = transactions[0]?.balance || 0

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
        description="ייבוא ומעקב תנועות בנק"
        actions={
          <Button onClick={() => setShowImportModal(true)}>
            <Upload className="w-4 h-4" />
            ייבוא מאקסל
          </Button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">יתרה נוכחית</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(currentBalance)}</p>
            </div>
            <div className="p-3 bg-primary-50 rounded-xl">
              <Link2 className="w-6 h-6 text-primary-600" />
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">זיכויים (נכנס)</p>
              <p className="text-2xl font-bold text-success-600">{formatCurrency(totalIncome)}</p>
            </div>
            <div className="p-3 bg-success-50 rounded-xl">
              <ArrowDownCircle className="w-6 h-6 text-success-600" />
            </div>
          </div>
        </Card>
        <Card padding="md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">חיובים (יוצא)</p>
              <p className="text-2xl font-bold text-danger-600">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="p-3 bg-danger-50 rounded-xl">
              <ArrowUpCircle className="w-6 h-6 text-danger-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card padding="md">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="חיפוש לפי תיאור..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <Select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              options={[
                { value: '', label: 'כל החודשים' },
                { value: '2025-01', label: 'ינואר 2025' },
                { value: '2025-02', label: 'פברואר 2025' },
                { value: '2025-03', label: 'מרץ 2025' },
                { value: '2025-04', label: 'אפריל 2025' },
                { value: '2025-05', label: 'מאי 2025' },
                { value: '2025-06', label: 'יוני 2025' },
                { value: '2025-07', label: 'יולי 2025' },
                { value: '2025-08', label: 'אוגוסט 2025' },
                { value: '2025-09', label: 'ספטמבר 2025' },
                { value: '2025-10', label: 'אוקטובר 2025' },
                { value: '2025-11', label: 'נובמבר 2025' },
                { value: '2025-12', label: 'דצמבר 2025' },
                { value: '2024-01', label: 'ינואר 2024' },
                { value: '2024-02', label: 'פברואר 2024' },
                { value: '2024-03', label: 'מרץ 2024' },
                { value: '2024-04', label: 'אפריל 2024' },
                { value: '2024-05', label: 'מאי 2024' },
                { value: '2024-06', label: 'יוני 2024' },
                { value: '2024-07', label: 'יולי 2024' },
                { value: '2024-08', label: 'אוגוסט 2024' },
                { value: '2024-09', label: 'ספטמבר 2024' },
                { value: '2024-10', label: 'אוקטובר 2024' },
                { value: '2024-11', label: 'נובמבר 2024' },
                { value: '2024-12', label: 'דצמבר 2024' },
              ]}
              className="w-40"
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card padding="none">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>תאריך</TableHead>
              <TableHead>תיאור</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>יתרה</TableHead>
              <TableHead>התאמה</TableHead>
              <TableHead>פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  <div className="space-y-2">
                    <p>אין תנועות בנק להצגה</p>
                    <p className="text-sm">ייבא תנועות מקובץ Excel של הבנק</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredTransactions.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{formatDateShort(item.date)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{item.description || '-'}</p>
                      {item.bank_name && (
                        <p className="text-xs text-gray-500">{item.bank_name}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'font-semibold',
                        item.amount >= 0 ? 'text-success-600' : 'text-danger-600'
                      )}
                    >
                      {item.amount >= 0 ? '+' : ''}{formatCurrency(item.amount)}
                    </span>
                  </TableCell>
                  <TableCell>{item.balance ? formatCurrency(item.balance) : '-'}</TableCell>
                  <TableCell>
                    {item.matched_type ? (
                      <Badge variant="success">
                        {item.matched_type === 'income' ? 'הכנסה' : 'הוצאה'}
                      </Badge>
                    ) : (
                      <Badge variant="default">לא מותאם</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!item.matched_type && (
                      <Link href="/reconciliation">
                        <Button size="sm" variant="outline">
                          <ArrowLeftRight className="w-3 h-3" />
                          התאם
                        </Button>
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Import Modal */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        size="xl"
      >
        <ExcelImport
          type="bank"
          requiredFields={[
            { key: 'date', label: 'תאריך', required: true },
            { key: 'amount', label: 'סכום', required: true },
            { key: 'description', label: 'תיאור', required: false },
            { key: 'balance', label: 'יתרה', required: false },
            { key: 'bank_name', label: 'שם הבנק', required: false },
            { key: 'account_number', label: 'מספר חשבון', required: false },
          ]}
          onImport={handleImport}
          onClose={() => setShowImportModal(false)}
        />
      </Modal>
    </div>
  )
}
