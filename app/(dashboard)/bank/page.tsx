'use client'

import { useEffect, useState } from 'react'
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
import { Upload, Search, ArrowUpCircle, ArrowDownCircle, Link2 } from 'lucide-react'
import type { BankTransaction } from '@/types'

export default function BankPage() {
  const [transactions, setTransactions] = useState<BankTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showImportModal, setShowImportModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [companyId, setCompanyId] = useState<string | null>(null)

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

  const filteredTransactions = transactions.filter(item =>
    !searchTerm || item.description?.includes(searchTerm)
  )

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

      {/* Search */}
      <Card padding="md">
        <div className="relative max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="חיפוש לפי תיאור..."
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
              <TableHead>תאריך</TableHead>
              <TableHead>תיאור</TableHead>
              <TableHead>סכום</TableHead>
              <TableHead>יתרה</TableHead>
              <TableHead>התאמה</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-gray-500">
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
