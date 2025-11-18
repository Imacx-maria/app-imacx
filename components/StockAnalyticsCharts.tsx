// @ts-nocheck
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createBrowserClient } from '@/utils/supabase'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
} from 'recharts'
import {
  RotateCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
} from 'lucide-react'
import { MATERIAL_COLORS, generateChartColors } from '@/lib/chart-colors'

// Using CSS variables for theme-aware colors
// Colors are defined in globals.css and adapt to light/dark mode
const COLORS = {
  CARTAO: MATERIAL_COLORS.CARTAO(),
  RIGIDOS: MATERIAL_COLORS.RIGIDOS(),
  FLEXIVEIS: MATERIAL_COLORS.FLEXIVEIS(),
  CRITICAL: MATERIAL_COLORS.CRITICAL(),
  WARNING: MATERIAL_COLORS.WARNING(),
  GOOD: MATERIAL_COLORS.GOOD(),
}

const CARACTERISTICA_COLORS = generateChartColors(12)

interface CurrentStock {
  id: string
  material: string | null
  cor: string | null
  tipo: string | null
  carateristica: string | null
  total_recebido: number
  total_consumido: number
  stock_atual: number
  stock_minimo: number | null
  stock_critico: number | null
  referencia?: string | null
  stock_correct?: number | null
  stock_correct_updated_at?: string | null
}

interface StockEntry {
  id: string
  data: string
  material_id: string
  quantidade: number
  materiais?: {
    material: string | null
    tipo: string | null
  } | null
}

interface StockAnalyticsChartsProps {
  currentStocks: CurrentStock[]
  onRefresh?: () => void
}

export default function StockAnalyticsCharts({
  currentStocks,
  onRefresh,
}: StockAnalyticsChartsProps) {
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('rigidos')

  const supabase = createBrowserClient()

  const fetchStockEntries = useCallback(async () => {
    setLoading(true)
    try {
      const { data: stockEntriesData } = await supabase
        .from('stocks')
        .select(
          `
          id, data, material_id, quantidade,
          materiais(material, tipo)
        `,
        )
        .gte(
          'data',
          new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split('T')[0],
        )
        .order('data', { ascending: true })

      if (stockEntriesData) {
        const transformedData = stockEntriesData.map((entry: any) => ({
          ...entry,
          materiais:
            Array.isArray(entry.materiais) && entry.materiais.length > 0
              ? entry.materiais[0]
              : entry.materiais,
        }))
        setStockEntries(transformedData)
      }
    } catch (error) {
      console.error('Error fetching stock entries:', error)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchStockEntries()
  }, [fetchStockEntries])

  const chartData = useMemo(() => {
    const rigidosMaterials = currentStocks.filter(
      (stock) =>
        stock.tipo?.toLowerCase() === 'rígidos' ||
        stock.tipo?.toLowerCase() === 'rigidos',
    )
    const flexiveisMaterials = currentStocks.filter(
      (stock) =>
        stock.tipo?.toLowerCase() === 'flexíveis' ||
        stock.tipo?.toLowerCase() === 'flexiveis',
    )

    const cartaoMaterials = rigidosMaterials.filter(
      (stock) =>
        stock.material?.toLowerCase().includes('cartão') ||
        stock.material?.toLowerCase().includes('cartao') ||
        stock.material?.toLowerCase().includes('favo'),
    )

    const outrosRigidosMaterials = rigidosMaterials.filter(
      (stock) =>
        !(
          stock.material?.toLowerCase().includes('cartão') ||
          stock.material?.toLowerCase().includes('cartao') ||
          stock.material?.toLowerCase().includes('favo')
        ),
    )

    const getMaterialCost = (stockId: string) => {
      return 10
    }

    const getFinalStock = (stock: CurrentStock) => {
      return stock.stock_correct !== null && stock.stock_correct !== undefined
        ? stock.stock_correct
        : stock.stock_atual
    }

    const cartaoStockData = cartaoMaterials
      .map((stock) => {
        const finalStock = getFinalStock(stock)
        return {
          name: `${stock.material || ''} ${stock.cor || ''}`
            .trim()
            .substring(0, 20),
          fullName: `${stock.material || ''} ${stock.cor || ''}`.trim(),
          atual: Math.round(finalStock),
          value: Math.round(finalStock * getMaterialCost(stock.id)),
        }
      })
      .filter((item) => item.atual > 0)
      .sort((a, b) => b.atual - a.atual)
      .slice(0, 10)

    const outrosRigidosStockData = outrosRigidosMaterials
      .map((stock) => {
        const finalStock = getFinalStock(stock)
        return {
          name: `${stock.material || ''} ${stock.cor || ''}`
            .trim()
            .substring(0, 20),
          fullName: `${stock.material || ''} ${stock.cor || ''}`.trim(),
          atual: Math.round(finalStock),
          value: Math.round(finalStock * getMaterialCost(stock.id)),
        }
      })
      .filter((item) => item.atual > 0)
      .sort((a, b) => b.atual - a.atual)
      .slice(0, 10)

    const outrosRigidosStackedData = (() => {
      const groupedByMaterialCor = outrosRigidosMaterials
        .filter((stock) => getFinalStock(stock) > 0)
        .reduce(
          (acc, stock) => {
            const materialCor =
              `${stock.material || ''} ${stock.cor || ''}`.trim()
            const caracteristica =
              stock.carateristica?.trim() || 'Sem Característica'
            const finalStock = getFinalStock(stock)

            if (!acc[materialCor]) {
              acc[materialCor] = {
                name: materialCor.substring(0, 20),
                fullName: materialCor,
                total: 0,
              }
            }

            if (!acc[materialCor][caracteristica]) {
              acc[materialCor][caracteristica] = 0
            }

            acc[materialCor][caracteristica] += Math.round(finalStock)
            acc[materialCor].total += Math.round(finalStock)

            return acc
          },
          {} as Record<string, any>,
        )

      return Object.values(groupedByMaterialCor)
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 10)
    })()

    const uniqueCaracteristicas = Array.from(
      new Set(
        outrosRigidosMaterials
          .filter((stock) => getFinalStock(stock) > 0)
          .map((stock) => stock.carateristica?.trim() || 'Sem Característica'),
      ),
    ).sort()

    const flexiveisStockData = flexiveisMaterials
      .map((stock) => {
        const finalStock = getFinalStock(stock)
        return {
          name: `${stock.material || ''} ${stock.cor || ''}`
            .trim()
            .substring(0, 25),
          fullName: `${stock.material || ''} ${stock.cor || ''}`.trim(),
          atual: Math.round(finalStock),
          value: Math.round(finalStock * getMaterialCost(stock.id)),
        }
      })
      .filter((item) => item.atual > 0)
      .sort((a, b) => b.atual - a.atual)
      .slice(0, 15)

    const cartaoPercentageData = cartaoMaterials
      .map((stock) => {
        const finalStock = getFinalStock(stock)
        return {
          name: `${stock.material || ''} ${stock.cor || ''}`.trim(),
          value: Math.round(finalStock),
          percentage: 0,
        }
      })
      .filter((item) => item.value > 0)

    const totalCartaoQuantity = cartaoPercentageData.reduce(
      (sum, item) => sum + item.value,
      0,
    )
    cartaoPercentageData.forEach((item) => {
      item.percentage =
        totalCartaoQuantity > 0 ? (item.value / totalCartaoQuantity) * 100 : 0
    })

    const outrosRigidosPercentageData = outrosRigidosMaterials
      .map((stock) => {
        const finalStock = getFinalStock(stock)
        return {
          name: `${stock.material || ''} ${stock.cor || ''}`.trim(),
          value: Math.round(finalStock),
          percentage: 0,
        }
      })
      .filter((item) => item.value > 0)

    const totalOutrosRigidosQuantity = outrosRigidosPercentageData.reduce(
      (sum, item) => sum + item.value,
      0,
    )
    outrosRigidosPercentageData.forEach((item) => {
      item.percentage =
        totalOutrosRigidosQuantity > 0
          ? (item.value / totalOutrosRigidosQuantity) * 100
          : 0
    })

    const cartaoTrendData = stockEntries
      .filter(
        (entry) =>
          entry.materiais?.material?.toLowerCase().includes('cartão') ||
          entry.materiais?.material?.toLowerCase().includes('cartao') ||
          entry.materiais?.material?.toLowerCase().includes('favo'),
      )
      .reduce(
        (acc, entry) => {
          const month = entry.data.substring(0, 7)
          if (!acc[month]) {
            acc[month] = { month, quantidade: 0, entries: 0 }
          }
          acc[month].quantidade += entry.quantidade
          acc[month].entries += 1
          return acc
        },
        {} as Record<
          string,
          { month: string; quantidade: number; entries: number }
        >,
      )

    const cartaoTrendArray = Object.values(cartaoTrendData)
      .sort((a, b) => a.month.localeCompare(b.month))
      .map((item) => ({
        ...item,
        monthName: new Date(item.month + '-01').toLocaleDateString('pt-PT', {
          month: 'short',
          year: '2-digit',
        }),
      }))

    const totalCartaoValue = cartaoMaterials.reduce(
      (sum, stock) => sum + getFinalStock(stock) * getMaterialCost(stock.id),
      0,
    )
    const totalOutrosRigidosValue = outrosRigidosMaterials.reduce(
      (sum, stock) => sum + getFinalStock(stock) * getMaterialCost(stock.id),
      0,
    )
    const totalFlexiveisValue = flexiveisMaterials.reduce(
      (sum, stock) => sum + getFinalStock(stock) * getMaterialCost(stock.id),
      0,
    )
    const totalAllValue =
      totalCartaoValue + totalOutrosRigidosValue + totalFlexiveisValue

    return {
      cartaoStockData,
      outrosRigidosStockData,
      outrosRigidosStackedData,
      uniqueCaracteristicas,
      flexiveisStockData,
      cartaoPercentageData: cartaoPercentageData.slice(0, 8),
      outrosRigidosPercentageData: outrosRigidosPercentageData.slice(0, 8),
      cartaoTrendData: cartaoTrendArray,
      cartaoMaterials,
      totalCartaoValue,
      totalOutrosRigidosValue,
      totalFlexiveisValue,
      totalAllValue,
      totalCartaoStock: cartaoMaterials.reduce(
        (sum, stock) => sum + getFinalStock(stock),
        0,
      ),
      totalRigidosStock: rigidosMaterials.reduce(
        (sum, stock) => sum + getFinalStock(stock),
        0,
      ),
      totalFlexiveisStock: flexiveisMaterials.reduce(
        (sum, stock) => sum + getFinalStock(stock),
        0,
      ),
    }
  }, [currentStocks, stockEntries])

  const handleRefresh = () => {
    fetchStockEntries()
    if (onRefresh) onRefresh()
  }



  return (
    <div className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-bold">Análise de Stocks</h2>
          <p className="text-muted-foreground">
            Visualização e análise de dados de inventário
          </p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={handleRefresh}
          className="h-10 w-10"
        >
          <RotateCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Cartão & Favo
            </CardTitle>
            <Package className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {chartData.totalCartaoValue.toLocaleString('pt-PT', {
                style: 'currency',
                currency: 'EUR',
              })}
            </div>
            <p className="text-muted-foreground text-xs">
              Materiais principais (~85% produção)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Rígidos Outros
            </CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {chartData.totalOutrosRigidosValue.toLocaleString('pt-PT', {
                style: 'currency',
                currency: 'EUR',
              })}
            </div>
            <p className="text-muted-foreground text-xs">
              Outros materiais rígidos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Flexíveis
            </CardTitle>
            <TrendingDown className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {chartData.totalFlexiveisValue.toLocaleString('pt-PT', {
                style: 'currency',
                currency: 'EUR',
              })}
            </div>
            <p className="text-muted-foreground text-xs">Materiais flexíveis</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Geral</CardTitle>
            <AlertTriangle className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {chartData.totalAllValue.toLocaleString('pt-PT', {
                style: 'currency',
                currency: 'EUR',
              })}
            </div>
            <p className="text-muted-foreground text-xs">
              Valor total de stock
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rigidos">Materiais Rígidos</TabsTrigger>
          <TabsTrigger value="flexiveis">Materiais Flexíveis</TabsTrigger>
          <TabsTrigger value="cartao">Análise Cartão & Favo</TabsTrigger>
        </TabsList>

        <TabsContent value="rigidos" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Níveis de Stock - Cartão & Favo</CardTitle>
                <CardDescription>
                  Top 10 materiais principais por quantidade
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={550}>
                  <BarChart data={chartData.cartaoStockData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 12 }}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={120}
                    />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name, props: any) => [
                        value,
                        name,
                        props?.payload?.fullName,
                      ]}
                    />
                    <Legend />
                    <Bar
                      dataKey="atual"
                      name="Stock Atual"
                      fill={COLORS.CARTAO}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Outros Materiais Rígidos</CardTitle>
                <CardDescription>
                  Por material+cor, detalhado por características (Top 10)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.outrosRigidosStackedData.length === 0 ? (
                  <div className="flex h-[400px] items-center justify-center">
                    <div className="text-center">
                      <Package className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
                      <h3 className="text-muted-foreground mb-2 text-base font-medium">
                        Nenhum Outro Material Rígido
                      </h3>
                      <p className="text-muted-foreground max-w-sm text-sm">
                        Apenas materiais Cartão e Favo em stock atualmente.
                      </p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={550}>
                    <BarChart data={chartData.outrosRigidosStackedData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 12 }}
                        interval={0}
                        angle={-45}
                        textAnchor="end"
                        height={120}
                      />
                      <YAxis />
                      <Tooltip
                        formatter={(value, name) => [
                          `${value} unidades`,
                          name,
                        ]}
                        labelFormatter={(label, payload) =>
                          payload && payload[0]
                            ? `Material: ${payload[0].payload.fullName}`
                            : `Material: ${label}`
                        }
                      />
                      <Legend />
                      {chartData.uniqueCaracteristicas.map(
                        (caracteristica, index) => (
                          <Bar
                            key={caracteristica}
                            dataKey={caracteristica}
                            name={caracteristica}
                            stackId="a"
                            fill={
                              CARACTERISTICA_COLORS[
                                index % CARACTERISTICA_COLORS.length
                              ]
                            }
                          />
                        ),
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição Percentual - Cartão & Favo</CardTitle>
                <CardDescription>
                  Materiais principais mais utilizados
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={700}>
                  <PieChart>
                    <Pie
                      data={chartData.cartaoPercentageData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) =>
                        percentage > 2 ? `${percentage.toFixed(1)}%` : ''
                      }
                      outerRadius={280}
                      fill={COLORS.CARTAO}
                      dataKey="value"
                    >
                      {chartData.cartaoPercentageData.map(
                        (entry: any, index: number) => {
                          const baseColors = [
                            { hex: '#f9d16a', name: 'yellow' },
                            { hex: '#c3b49e', name: 'beige' },
                            { hex: '#72a25e', name: 'green' },
                            { hex: '#2a687a', name: 'teal' },
                            { hex: '#3c3434', name: 'charcoal' },
                          ]

                          const hexToRgba = (hex: string, alpha: number) => {
                            const r = parseInt(hex.slice(1, 3), 16)
                            const g = parseInt(hex.slice(3, 5), 16)
                            const b = parseInt(hex.slice(5, 7), 16)
                            return `rgba(${r}, ${g}, ${b}, ${alpha})`
                          }

                          const colorIndex = index % baseColors.length
                          const transparencyLevel =
                            index < baseColors.length
                              ? 1.0 - index * 0.15
                              : 0.9 - (index - baseColors.length) * 0.1

                          const finalOpacity = Math.max(0.3, transparencyLevel)
                          const color = hexToRgba(
                            baseColors[colorIndex].hex,
                            finalOpacity,
                          )

                          return <Cell key={`cell-${index}`} fill={color} />
                        },
                      )}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [`${value} unidades`, name]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Distribuição - Outros Rígidos</CardTitle>
                <CardDescription>
                  Outros materiais rígidos mais utilizados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {chartData.outrosRigidosPercentageData.length === 0 ? (
                  <div className="flex h-[700px] items-center justify-center">
                    <div className="text-center">
                      <Package className="text-muted-foreground mx-auto mb-4 h-16 w-16" />
                      <h3 className="text-muted-foreground mb-2 text-lg font-medium">
                        Nenhum Outro Material Rígido
                      </h3>
                      <p className="text-muted-foreground max-w-md text-sm">
                        Todos os materiais rígidos em stock são Cartão ou Favo.
                        Outros materiais rígidos (como PVC, Acrílico, etc.)
                        aparecerão aqui quando houver stock.
                      </p>
                    </div>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={700}>
                    <PieChart>
                      <Pie
                        data={chartData.outrosRigidosPercentageData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percentage }) =>
                          percentage > 2 ? `${percentage.toFixed(1)}%` : ''
                        }
                        outerRadius={280}
                        fill={COLORS.RIGIDOS}
                        dataKey="value"
                      >
                        {chartData.outrosRigidosPercentageData.map(
                          (entry: any, index: number) => {
                            const baseColors = [
                              { hex: '#2a687a', name: 'teal' },
                              { hex: '#72a25e', name: 'green' },
                              { hex: '#c3b49e', name: 'beige' },
                              { hex: '#f9d16a', name: 'yellow' },
                              { hex: '#3c3434', name: 'charcoal' },
                            ]

                            const hexToRgba = (hex: string, alpha: number) => {
                              const r = parseInt(hex.slice(1, 3), 16)
                              const g = parseInt(hex.slice(3, 5), 16)
                              const b = parseInt(hex.slice(5, 7), 16)
                              return `rgba(${r}, ${g}, ${b}, ${alpha})`
                            }

                            const colorIndex = index % baseColors.length
                            const transparencyLevel =
                              index < baseColors.length
                                ? 1.0 - index * 0.15
                                : 0.9 - (index - baseColors.length) * 0.1

                            const finalOpacity = Math.max(
                              0.3,
                              transparencyLevel,
                            )
                            const color = hexToRgba(
                              baseColors[colorIndex].hex,
                              finalOpacity,
                            )

                            return <Cell key={`cell-${index}`} fill={color} />
                          },
                        )}
                      </Pie>
                      <Tooltip
                        formatter={(value, name) => [`${value} unidades`, name]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição Geral - Materiais Rígidos</CardTitle>
              <CardDescription>
                Percentagem entre Cartão & Favo vs Outros Rígidos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: 'Cartão & Favo',
                        value: chartData.totalCartaoStock,
                        percentage:
                          chartData.totalCartaoStock +
                            chartData.totalRigidosStock -
                            chartData.totalCartaoStock >
                          0
                            ? (chartData.totalCartaoStock /
                                (chartData.totalCartaoStock +
                                  (chartData.totalRigidosStock -
                                    chartData.totalCartaoStock))) *
                              100
                            : 100,
                      },
                      {
                        name: 'Outros Rígidos',
                        value:
                          chartData.totalRigidosStock -
                          chartData.totalCartaoStock,
                        percentage:
                          chartData.totalCartaoStock +
                            chartData.totalRigidosStock -
                            chartData.totalCartaoStock >
                          0
                            ? ((chartData.totalRigidosStock -
                                chartData.totalCartaoStock) /
                                (chartData.totalCartaoStock +
                                  (chartData.totalRigidosStock -
                                    chartData.totalCartaoStock))) *
                              100
                            : 0,
                      },
                    ].filter((item) => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) =>
                      `${name}: ${percentage.toFixed(1)}%`
                    }
                    outerRadius={150}
                    dataKey="value"
                  >
                    <Cell fill={COLORS.CARTAO} />
                    <Cell fill={COLORS.RIGIDOS} />
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      `${Math.round(Number(value))} unidades`,
                      name,
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                <div className="imx-border p-4">
                  <div className="text-2xl font-bold">
                    {Math.round(chartData.totalCartaoStock)}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Cartão & Favo (unidades)
                  </div>
                </div>
                <div className="imx-border p-4">
                  <div className="text-2xl font-bold">
                    {Math.round(
                      chartData.totalRigidosStock - chartData.totalCartaoStock,
                    )}
                  </div>
                  <div className="text-muted-foreground text-sm">
                    Outros Rígidos (unidades)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="flexiveis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Níveis de Stock - Materiais Flexíveis</CardTitle>
              <CardDescription>
                Top 15 materiais flexíveis por quantidade atual
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={500}>
                <BarChart
                  data={chartData.flexiveisStockData}
                  layout="horizontal"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    width={150}
                  />
                  <Tooltip
                    formatter={(value, name, props) => [
                      value,
                      name,
                      props?.payload?.fullName,
                    ]}
                  />
                  <Legend />
                  <Bar
                    dataKey="atual"
                    name="Stock Atual"
                    fill={COLORS.FLEXIVEIS}
                  />
                  <Bar dataKey="minimo" name="Mínimo" fill="#fbbf24" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cartao" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Evolução Receção Cartão & Favo</CardTitle>
                <CardDescription>
                  Quantidade recebida por mês (últimos 6 meses)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData.cartaoTrendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monthName" />
                    <YAxis />
                    <Tooltip
                      formatter={(value, name) => [
                        `${value} unidades`,
                        name === 'quantidade'
                          ? 'Quantidade Recebida'
                          : name,
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="quantidade"
                      stroke={COLORS.CARTAO}
                      fill={COLORS.CARTAO}
                      fillOpacity={0.3}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detalhes Cartão & Favo</CardTitle>
                <CardDescription>
                  Breakdown por tipo de material principal
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {chartData.cartaoMaterials
                    .slice(0, 8)
                    .map((material, index) => (
                      <div
                        key={material.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {`${material.material || ''} ${material.cor || ''}`.trim()}
                          </div>
                          <div className="text-muted-foreground text-xs">
                            {material.referencia || 'Sem referência'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold">
                            {Math.round(material.stock_atual)}
                          </div>
                          <div
                            className={`text-xs ${
                              material.stock_atual <=
                              (material.stock_critico || 0)
                                ? 'text-destructive'
                                : material.stock_atual <=
                                    (material.stock_minimo || 10)
                                  ? 'text-amber-600'
                                  : 'text-success'
                            }`}
                          >
                            {material.stock_atual <=
                            (material.stock_critico || 0)
                              ? 'CRÍTICO'
                              : material.stock_atual <=
                                  (material.stock_minimo || 10)
                                ? 'BAIXO'
                                : 'OK'}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
