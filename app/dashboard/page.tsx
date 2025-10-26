'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { 
  Package, 
  ClipboardList, 
  FileText, 
  Palette,
  ArrowRight,
  Clock
} from 'lucide-react'
import { LogisticaTable } from '@/components/LogisticaTable'
import { FullYearCalendar } from '@/components/FullYearCalendar'
import { createBrowserClient } from '@/utils/supabase'
import { format } from 'date-fns'

interface Holiday {
  id: string
  holiday_date: string
  description?: string
}

interface LogisticaRecord {
  logistica_id?: string
  item_id: string
  numero_fo: string
  cliente: string
  id_cliente?: string
  nome_campanha: string
  item_descricao: string
  quantidade?: number
  guia?: string
  local_recolha?: string
  local_entrega?: string
  transportadora?: string
  notas?: string
  concluido?: boolean
  data_saida?: string
  saiu?: boolean
  data?: string
  id_local_entrega?: string
  id_local_recolha?: string
}

const moduleCards = [
  {
    title: 'Stocks',
    description: 'Gestão de inventário e materiais',
    href: '/definicoes/stocks',
    icon: Package,
    badgeClass: 'bg-accent text-accent-foreground',
    stats: { label: 'Entradas Hoje', value: '-' },
  },
  {
    title: 'Produção',
    description: 'Acompanhamento de trabalhos',
    href: '/producao',
    icon: ClipboardList,
    badgeClass: 'bg-success text-success-foreground',
    stats: { label: 'Em Curso', value: '-' },
  },
  {
    title: 'Faturação',
    description: 'Gestão de faturas e sincronização',
    href: '/gestao/faturacao',
    icon: FileText,
    badgeClass: 'bg-info text-info-foreground',
    stats: { label: 'Por Faturar', value: '-' },
  },
  {
    title: 'Fluxo de Design',
    description: 'Workflow de design e paginação',
    href: '/designer-flow',
    icon: Palette,
    badgeClass: 'bg-warning text-warning-foreground',
    stats: { label: 'Em Aberto', value: '-' },
  },
]

export default function DashboardPage() {
  const [records, setRecords] = useState<LogisticaRecord[]>([])
  const [loading, setLoading] = useState(false)
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

  const fetchLogisticaData = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date()
      const weekAgo = new Date()
      weekAgo.setDate(today.getDate() - 7)

      const { data, error } = await supabase
        .from('logistica_entregas')
        .select(
          `
          *,
          items_base!inner (
            id,
            descricao,
            brindes,
            folha_obra_id,
            data_saida,
            folhas_obras (
              id,
              numero_orc,
              numero_fo:Numero_do_,
              nome_campanha:Trabalho,
              cliente:Nome,
              id_cliente,
              saiu,
              data_saida:Data_efeti
            )
          )
        `,
        )
        .gte('data', format(weekAgo, 'yyyy-MM-dd'))
        .lte('data', format(today, 'yyyy-MM-dd'))
        .order('data', { ascending: false })
        .limit(500)

      if (error) {
        console.error('Error fetching logistics data:', error)
        return
      }

      if (data) {
        const processedRecords = data.map((record: any) => {
          const folhaObra = record.items_base?.folhas_obras || {}
          return {
            logistica_id: record.id,
            item_id: record.items_base?.id || '',
            numero_fo: folhaObra.numero_fo || '-',
            cliente: folhaObra.cliente || '-',
            id_cliente: folhaObra.id_cliente,
            nome_campanha: folhaObra.nome_campanha || '-',
            item_descricao: record.items_base?.descricao || '-',
            quantidade: record.quantidade,
            guia: record.guia,
            local_recolha: record.local_recolha,
            local_entrega: record.local_entrega,
            transportadora: record.transportadora,
            notas: record.notas,
            concluido: record.concluido || false,
            data_saida: record.data_saida,
            saiu: record.saiu || false,
            data: record.data,
            id_local_entrega: record.id_local_entrega,
            id_local_recolha: record.id_local_recolha,
          }
        })

        setRecords(processedRecords)
      }
    } catch (error) {
      console.error('Error fetching logistics data:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchLogisticaData()
    fetchHolidays()
  }, [fetchLogisticaData, fetchHolidays])

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl">Painel de Controlo</h1>
        <p className="text-muted-foreground mt-2">Bem-vindo ao Sistema de Gestão de Produção IMACX</p>
      </div>

      {/* Calendar */}
      <div className="mt-8">
        <h2 className="text-2xl mb-6">Calendário</h2>
        <FullYearCalendar 
          holidays={holidays}
          year={new Date().getFullYear()}
        />
      </div>

      {/* Logistics Table */}
      <div className="mt-12">
        <LogisticaTable 
          records={records} 
          loading={loading}
          onRefresh={fetchLogisticaData}
        />
      </div>

      {/* Module Cards */}
      <div>
        <h2 className="text-xl mb-4">Acesso Rápido aos Módulos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {moduleCards.map((module) => {
            const Icon = module.icon
            return (
              <Link
                key={module.href}
                href={module.href}
                className="group rounded-none shadow-sm border border-border p-6 hover:shadow-lg hover:border-primary transition-all duration-200"
              >
                <div className="flex flex-col h-full">
                  <div className={`w-12 h-12 flex items-center justify-center rounded-none ${module.badgeClass} mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  <h3 className="text-lg mb-2">{module.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">{module.description}</p>
                  
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-muted-foreground">{module.stats.label}</p>
                        <p className="text-xl">{module.stats.value}</p>
                      </div>
                      <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="rounded-none shadow-sm border border-border p-6">
        <h2 className="text-xl mb-4">Atividade Recente</h2>
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p>Nenhuma atividade recente</p>
          <p className="text-sm mt-2">As atividades recentes aparecerão aqui</p>
        </div>
      </div>
    </div>
  )
}
