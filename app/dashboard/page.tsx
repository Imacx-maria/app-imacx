'use client'

import { useState, useEffect, useCallback } from 'react'
import { FullYearCalendar } from '@/components/FullYearCalendar'
import DashboardLogisticaTable from '@/components/DashboardLogisticaTable'
import { AddDeliveryDialog } from '@/components/AddDeliveryDialog'
import { createBrowserClient } from '@/utils/supabase'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DashboardHelpDialog } from '@/components/dashboard/DashboardHelpDialog'

interface Holiday {
  id: string
  holiday_date: string
  description?: string
}

interface ArmazemOption {
  value: string
  label: string
  morada?: string
  codigo_pos?: string
}

interface TransportadoraOption {
  value: string
  label: string
}

export default function DashboardPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [armazens, setArmazens] = useState<ArmazemOption[]>([])
  const [transportadoras, setTransportadoras] = useState<TransportadoraOption[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

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

  const fetchArmazens = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('armazens')
        .select('id, nome_arm, morada, codigo_pos')
        .order('nome_arm')

      if (error) {
        console.error('Error fetching armazens:', error)
        return
      }

      if (data) {
        setArmazens(
          data.map((a: any) => ({
            value: a.id,
            label: a.nome_arm,
            morada: a.morada,
            codigo_pos: a.codigo_pos,
          }))
        )
      }
    } catch (error) {
      console.error('Error fetching armazens:', error)
    }
  }, [supabase])

  const fetchTransportadoras = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('transportadora')
        .select('id, name')
        .order('name')

      if (error) {
        console.error('Error fetching transportadoras:', error)
        return
      }

      if (data) {
        setTransportadoras(
          data.map((t: any) => ({
            value: t.id,
            label: t.name,
          }))
        )
      }
    } catch (error) {
      console.error('Error fetching transportadoras:', error)
    }
  }, [supabase])

  useEffect(() => {
    fetchHolidays()
    fetchArmazens()
    fetchTransportadoras()
  }, [fetchHolidays, fetchArmazens, fetchTransportadoras])

  return (
    <div className="w-full space-y-8 px-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-3xl">Painel de Controlo</h1>
          <p className="mt-2">Bem-vindo ao Sistema de Gestão de Produção IMACX</p>
        </div>
        <DashboardHelpDialog />
      </div>

      {/* Calendar */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-6">Calendário</h2>
        <FullYearCalendar 
          holidays={holidays}
          year={new Date().getFullYear()}
          onSelect={(date) => setSelectedDate(date)}
        />
      </div>

      {/* Logistics Table */}
      <div className="mt-12">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold">Logística</h2>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <AddDeliveryDialog
                      armazens={armazens}
                      transportadoras={transportadoras}
                      onArmazensUpdate={fetchArmazens}
                      onTransportadorasUpdate={fetchTransportadoras}
                      onSuccess={() => setRefreshKey((prev) => prev + 1)}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Adicionar Nova Entrega</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <DashboardLogisticaTable
          key={refreshKey}
          selectedDate={selectedDate}
          onClearDate={() => setSelectedDate(undefined)}
          armazens={armazens}
          transportadoras={transportadoras}
          onArmazensUpdate={fetchArmazens}
          onTransportadorasUpdate={fetchTransportadoras}
        />
      </div>
    </div>
  )
}
