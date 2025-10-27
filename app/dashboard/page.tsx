'use client'

import { useState, useEffect, useCallback } from 'react'
import { FullYearCalendar } from '@/components/FullYearCalendar'
import DashboardLogisticaTable from '@/components/DashboardLogisticaTable'
import { createBrowserClient } from '@/utils/supabase'

interface Holiday {
  id: string
  holiday_date: string
  description?: string
}

export default function DashboardPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([])

  const supabase = createBrowserClient()

  const fetchHolidays = useCallback(async () => {
    try {
      const today = new Date()
      const startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0)
      
      const startDateStr = startDate.toISOString().split('T')[0]
      const endDateStr = endDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('feriados')
        .select('id, holiday_date, description')
        .gte('holiday_date', startDateStr)
        .lte('holiday_date', endDateStr)
        .order('holiday_date', { ascending: true })

      if (error) {
        console.error('Error fetching holidays:', error)
        return
      }

      if (data) {
        setHolidays(data)
      }
    } catch (error) {
      console.error('Error fetching holidays:', error)
    }
  }, [supabase])

  useEffect(() => {
    fetchHolidays()
  }, [fetchHolidays])

  return (
    <div className="w-full space-y-8 px-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl">Painel de Controlo</h1>
        <p className="mt-2">Bem-vindo ao Sistema de Gestão de Produção IMACX</p>
      </div>

      {/* Calendar */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-6">Calendário</h2>
        <FullYearCalendar 
          holidays={holidays}
          year={new Date().getFullYear()}
        />
      </div>

      {/* Logistics Table */}
      <div className="mt-12">
        <DashboardLogisticaTable />
      </div>
    </div>
  )
}
