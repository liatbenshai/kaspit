'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Company, MonthlySummary } from '@/types'
import { useAuth } from './useAuth'

export function useCompany() {
  const { user } = useAuth()
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchCompany = useCallback(async () => {
    if (!user?.company_id) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', user.company_id)
        .single()

      if (error) throw error
      setCompany(data as Company)
    } catch (error) {
      console.error('Error fetching company:', error)
    } finally {
      setLoading(false)
    }
  }, [user?.company_id])

  useEffect(() => {
    fetchCompany()
  }, [fetchCompany])

  const updateCompany = async (updates: Partial<Company>) => {
    if (!company) return

    const { error } = await supabase
      .from('companies')
      .update(updates)
      .eq('id', company.id)

    if (error) throw error

    setCompany({ ...company, ...updates })
  }

  const getMonthlySummary = async (
    year: number, 
    month: number
  ): Promise<MonthlySummary | null> => {
    if (!company) return null

    const { data, error } = await supabase.rpc('get_monthly_summary', {
      p_company_id: company.id,
      p_year: year,
      p_month: month,
    })

    if (error) {
      console.error('Error fetching monthly summary:', error)
      return null
    }

    return data?.[0] || null
  }

  return {
    company,
    loading,
    updateCompany,
    getMonthlySummary,
    companyId: company?.id,
  }
}
