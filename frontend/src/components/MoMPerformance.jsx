import React from 'react'
import ReactECharts from 'echarts-for-react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useTheme, formatFleet } from '../ThemeContext'

export default function MoMPerformance({ momPerformance, velocity }) {
  const { tw, ct } = useTheme()

  if (!momPerformance || momPerformance.length === 0) {
    return (
      <div className={`${tw.card} rounded-xl p-5`}>
        <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>
          Month-over-Month Performance
        </h2>
        <div className={`flex items-center justify-center h-40 ${tw.textSecondary}`}>
          No Closed Won deals with dates available
        </div>
      </div>
    )
  }

  const months = momPerformance.map(m => m.month)
  const counts = momPerformance.map(m => m.count || 0)
  const fleetSizes = momPerformance.map(m => m.total_deal_size || 0)

  const bestMonth = momPerformance.reduce((best, m) =>
    (m.total_deal_size || 0) > (best?.total_deal_size || 0) ? m : best, momPerformance[0])
  const totalCW = momPerformance.reduce((s, m) => s + (m.total_deal_size || 0), 0)
  const avgMonthly = momPerformance.length > 0 ? totalCW / momPerformance.length : 0
  const totalDeals = momPerformance.reduce((s, m) => s + (m.count || 0), 0)

  const option = {
    backgroundColor: ct.bg,
    tooltip: {
      trigger: 'axis',
      backgroundColor: ct.tooltip.backgroundColor,
      borderColor: ct.tooltip.borderColor,
      textStyle: ct.tooltip.textStyle,
      extraCssText: ct.tooltip.extraCssText,
      formatter: (params) => {
        const idx = params[0]?.dataIndex
        const row = momPerformance[idx]
        let html = `<b>${params[0]?.axisValue}</b><br/>`
        params.forEach(p => {
          if (p.seriesType === 'bar') html += `Opportunities: <b>${p.value}</b><br/>`
          if (p.seriesType === 'line') html += `Fleet Size: <b>${formatFleet(p.value)}</b> vehicles<br/>`
        })
        if (row?.growth_rate_pct != null) {
          const sign = row.growth_rate_pct >= 0 ? '+' : ''
          html += `Growth: <b>${sign}${row.growth_rate_pct.toFixed(1)}%</b>`
        }
        return html
      }
    },
    legend: {
      data: ['Opportunities', 'Fleet Size'],
      ...ct.legend,
      top: 0,
    },
    grid: { left: '2%', right: '8%', top: '12%', bottom: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: months,
      axisLine: { lineStyle: { color: ct.axisLine } },
      axisLabel: { color: ct.text, fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Opportunities',
        nameTextStyle: { color: ct.text, fontSize: 10 },
        axisLine: { lineStyle: { color: ct.axisLine } },
        splitLine: { lineStyle: { color: ct.splitLine } },
        axisLabel: { color: ct.text, fontSize: 10 },
        minInterval: 1,
      },
      {
        type: 'value',
        name: 'Fleet Size',
        nameTextStyle: { color: ct.text, fontSize: 10 },
        axisLine: { lineStyle: { color: ct.axisLine } },
        splitLine: { show: false },
        axisLabel: { color: ct.text, fontSize: 10, formatter: (v) => formatFleet(v) },
      }
    ],
    series: [
      {
        name: 'Opportunities',
        type: 'bar',
        data: counts.map(c => ({ value: c, itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] } })),
        yAxisIndex: 0,
        barMaxWidth: 40,
      },
      {
        name: 'Fleet Size',
        type: 'line',
        data: fleetSizes,
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: '#22c55e', width: 2.5 },
        itemStyle: { color: '#22c55e' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(34,197,94,0.3)' },
              { offset: 1, color: 'rgba(34,197,94,0.02)' }
            ]
          }
        },
        label: {
          show: momPerformance.length <= 12,
          position: 'top',
          color: '#22c55e',
          fontSize: 9,
          formatter: (p) => {
            const row = momPerformance[p.dataIndex]
            if (row?.growth_rate_pct != null) {
              const sign = row.growth_rate_pct >= 0 ? '+' : ''
              return `${sign}${row.growth_rate_pct.toFixed(0)}%`
            }
            return ''
          }
        }
      }
    ]
  }

  const lastGrowth = momPerformance[momPerformance.length - 1]?.growth_rate_pct

  return (
    <div className={`${tw.card} rounded-xl p-5`}>
      <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>
        Month-over-Month Performance
      </h2>

      <ReactECharts option={option} style={{ height: '350px', width: '100%' }} />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mt-5">
        <div className={`${tw.cardInner} rounded-xl p-4`}>
          <p className={`text-xs mb-1 ${tw.textSecondary}`}>Best Month</p>
          <p className={`font-bold text-lg ${tw.textPrimary}`}>{bestMonth?.month || '—'}</p>
          <p className="text-emerald-500 text-sm">{formatFleet(bestMonth?.total_deal_size)} vehicles</p>
        </div>
        <div className={`${tw.cardInner} rounded-xl p-4`}>
          <p className={`text-xs mb-1 ${tw.textSecondary}`}>Total Closed Won Fleet</p>
          <p className={`font-bold text-lg ${tw.textPrimary}`}>{formatFleet(totalCW)}</p>
          <p className={`text-sm ${tw.textSecondary}`}>{totalDeals} opportunities</p>
        </div>
        <div className={`${tw.cardInner} rounded-xl p-4`}>
          <p className={`text-xs mb-1 ${tw.textSecondary}`}>Avg Monthly Fleet Size</p>
          <p className={`font-bold text-lg ${tw.textPrimary}`}>{formatFleet(avgMonthly)}</p>
          {lastGrowth != null && (
            <span className={`flex items-center gap-1 text-sm ${lastGrowth > 0 ? 'text-emerald-500' : lastGrowth < 0 ? 'text-red-500' : tw.textSecondary}`}>
              {lastGrowth > 0 ? <TrendingUp className="w-3 h-3" /> : lastGrowth < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {lastGrowth > 0 ? '+' : ''}{lastGrowth.toFixed(1)}% last month
            </span>
          )}
        </div>
      </div>

      {/* Velocity */}
      {velocity && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className={`${tw.cardInnerBorder} rounded-lg p-3`}>
            <p className={`text-xs mb-1 ${tw.textSecondary}`}>Avg Days to Close</p>
            <p className={`font-semibold ${tw.textPrimary}`}>
              {velocity.avg_days_to_close ? `${Math.round(velocity.avg_days_to_close)} days` : '—'}
            </p>
          </div>
          <div className={`${tw.cardInnerBorder} rounded-lg p-3`}>
            <p className={`text-xs mb-1 ${tw.textSecondary}`}>Sales Velocity</p>
            <p className={`font-semibold ${tw.textPrimary}`}>
              {velocity.sales_velocity
                ? `${formatFleet(velocity.sales_velocity)} vehicles/day`
                : '—'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
