'use client'

import { useEffect, useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { translateRole } from '@/lib/utils'
import { Building2, User, Users, Bell, Shield, Save, Plus, Trash2 } from 'lucide-react'
import type { Company, User as UserType } from '@/types'
import { useAuth } from '@/hooks/useAuth'

export default function SettingsPage() {
  const { user: currentUser, isAdmin } = useAuth()
  const [company, setCompany] = useState<Company | null>(null)
  const [users, setUsers] = useState<UserType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [companyForm, setCompanyForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    tax_id: '',
  })

  const [profileForm, setProfileForm] = useState({
    full_name: '',
    email: '',
  })

  useEffect(() => {
    loadData()
  }, [currentUser])

  const loadData = async () => {
    if (!currentUser?.company_id) return

    try {
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('id', currentUser.company_id)
        .single()

      if (companyData) {
        setCompany(companyData)
        setCompanyForm({
          name: companyData.name || '',
          address: companyData.address || '',
          phone: companyData.phone || '',
          email: companyData.email || '',
          tax_id: companyData.tax_id || '',
        })
      }

      setProfileForm({
        full_name: currentUser.full_name || '',
        email: currentUser.email || '',
      })

      if (isAdmin) {
        const { data: usersData } = await supabase
          .from('users')
          .select('*')
          .eq('company_id', currentUser.company_id)
          .order('created_at')

        setUsers(usersData || [])
      }
    } catch (error) {
      console.error('Error loading settings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveCompany = async () => {
    if (!company) return
    setSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('companies')
        .update(companyForm)
        .eq('id', company.id)

      if (updateError) throw updateError

      setSuccess('פרטי החברה נשמרו בהצלחה')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleSaveProfile = async () => {
    if (!currentUser) return
    setSaving(true)
    setError(null)

    try {
      const { error: updateError } = await supabase
        .from('users')
        .update({ full_name: profileForm.full_name })
        .eq('id', currentUser.id)

      if (updateError) throw updateError

      setSuccess('הפרופיל נשמר בהצלחה')
      setTimeout(() => setSuccess(null), 3000)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser?.id) {
      setError('לא ניתן למחוק את עצמך')
      return
    }

    if (!confirm('האם למחוק משתמש זה?')) return

    try {
      await supabase.from('users').delete().eq('id', userId)
      loadData()
    } catch (err: any) {
      setError(err.message)
    }
  }

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
        title="הגדרות"
        description="ניהול הגדרות המערכת והחשבון"
      />

      {success && (
        <Alert variant="success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary-600" />
              <CardTitle>פרטי החברה</CardTitle>
            </div>
          </CardHeader>

          <div className="space-y-4">
            <Input
              label="שם החברה"
              value={companyForm.name}
              onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
            />
            <Input
              label="כתובת"
              value={companyForm.address}
              onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="טלפון"
                value={companyForm.phone}
                onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
              />
              <Input
                label="אימייל"
                type="email"
                value={companyForm.email}
                onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
              />
            </div>
            <Input
              label="ח.פ / ע.מ"
              value={companyForm.tax_id}
              onChange={(e) => setCompanyForm({ ...companyForm, tax_id: e.target.value })}
            />
            <Button onClick={handleSaveCompany} loading={saving}>
              <Save className="w-4 h-4" />
              שמור שינויים
            </Button>
          </div>
        </Card>

        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="w-5 h-5 text-primary-600" />
              <CardTitle>הפרופיל שלי</CardTitle>
            </div>
          </CardHeader>

          <div className="space-y-4">
            <Input
              label="שם מלא"
              value={profileForm.full_name}
              onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
            />
            <Input
              label="אימייל"
              type="email"
              value={profileForm.email}
              disabled
              hint="לא ניתן לשנות את האימייל"
            />
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                תפקיד: <span className="font-medium">{translateRole(currentUser?.role || '')}</span>
              </p>
            </div>
            <Button onClick={handleSaveProfile} loading={saving}>
              <Save className="w-4 h-4" />
              שמור שינויים
            </Button>
          </div>
        </Card>

        {/* Users Management - Admin Only */}
        {isAdmin && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary-600" />
                  <CardTitle>ניהול משתמשים</CardTitle>
                </div>
                <Button size="sm" variant="outline">
                  <Plus className="w-4 h-4" />
                  הזמן משתמש
                </Button>
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">שם</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">אימייל</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">תפקיד</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">סטטוס</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">פעולות</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{user.full_name || '-'}</td>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={user.role === 'admin' ? 'info' : 'default'}>
                          {translateRole(user.role)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="success">פעיל</Badge>
                      </td>
                      <td className="px-4 py-3">
                        {user.id !== currentUser?.id && (
                          <button
                            onClick={() => handleDeleteUser(user.id)}
                            className="p-1 text-gray-400 hover:text-danger-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Notifications Settings */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-primary-600" />
              <CardTitle>התראות</CardTitle>
            </div>
          </CardHeader>

          <div className="space-y-4">
            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
              <span className="text-sm font-medium">התראה על חריגה מתקציב</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 text-primary-600 rounded" />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
              <span className="text-sm font-medium">תזכורת לחשבוניות שלא שולמו</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 text-primary-600 rounded" />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
              <span className="text-sm font-medium">סיכום שבועי באימייל</span>
              <input type="checkbox" className="w-4 h-4 text-primary-600 rounded" />
            </label>
            <label className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer">
              <span className="text-sm font-medium">התראה על יתרה נמוכה</span>
              <input type="checkbox" defaultChecked className="w-4 h-4 text-primary-600 rounded" />
            </label>
          </div>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-600" />
              <CardTitle>אבטחה</CardTitle>
            </div>
          </CardHeader>

          <div className="space-y-4">
            <Button variant="outline" className="w-full justify-start">
              שינוי סיסמה
            </Button>
            <Button variant="outline" className="w-full justify-start">
              ניהול הרשאות
            </Button>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                התחברות אחרונה: {currentUser?.last_login 
                  ? new Date(currentUser.last_login).toLocaleString('he-IL')
                  : 'לא זמין'
                }
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
