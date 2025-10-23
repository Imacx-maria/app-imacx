'use client'

import Link from 'next/link'
import { 
  Package, 
  ClipboardList, 
  FileText, 
  Palette,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'

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

const quickStats = [
  {
    label: 'Trabalhos Ativos',
    value: '-',
    icon: TrendingUp,
    iconClass: 'text-info',
    wrapperClass: 'bg-info/15 text-info',
  },
  {
    label: 'Pendentes',
    value: '-',
    icon: Clock,
    iconClass: 'text-warning',
    wrapperClass: 'bg-warning/20 text-warning-foreground',
  },
  {
    label: 'Concluídos Hoje',
    value: '-',
    icon: CheckCircle,
    iconClass: 'text-success',
    wrapperClass: 'bg-success/20 text-success-foreground',
  },
  {
    label: 'Alertas',
    value: '-',
    icon: AlertCircle,
    iconClass: 'text-destructive',
    wrapperClass: 'bg-destructive/10 text-destructive',
  },
]

export default function DashboardPage() {

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Painel de Controlo</h1>
        <p className="text-muted-foreground mt-2">Bem-vindo ao Sistema de Gestão de Produção IMACX</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="bg-card rounded-xl shadow-sm border border-border p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-3xl font-bold mt-2">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.wrapperClass}`}>
                  <Icon className={`w-6 h-6 ${stat.iconClass}`} />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Module Cards */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Acesso Rápido aos Módulos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {moduleCards.map((module) => {
            const Icon = module.icon
            return (
              <Link
                key={module.href}
                href={module.href}
                className="group bg-card rounded-xl shadow-sm border border-border p-6 hover:shadow-lg hover:border-primary transition-all duration-200"
              >
                <div className="flex flex-col h-full">
                  <div className={`w-12 h-12 flex items-center justify-center rounded-lg ${module.badgeClass} mb-4`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  
                  <h3 className="text-lg font-semibold mb-2">{module.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 flex-1">{module.description}</p>
                  
                  <div className="pt-4 border-t border-border">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-muted-foreground">{module.stats.label}</p>
                        <p className="text-xl font-bold">{module.stats.value}</p>
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
      <div className="bg-card rounded-xl shadow-sm border border-border p-6">
        <h2 className="text-xl font-semibold mb-4">Atividade Recente</h2>
        <div className="text-center py-12 text-muted-foreground">
          <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
          <p>Nenhuma atividade recente</p>
          <p className="text-sm mt-2">As atividades recentes aparecerão aqui</p>
        </div>
      </div>
    </div>
  )
}
