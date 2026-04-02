import React from 'react'
import ReactECharts from 'echarts-for-react'
import { useTheme, formatFleet } from '../ThemeContext'

const FUNNEL_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#6366f1', '#14b8a6']

export default function SalesFunnel({ funnel }) {
  const { tw, ct } = useTheme()

  if (!funnel || funnel.length === 0) {
    return (
      <div className={`${tw.card} rounded-xl p-5`}>
        <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>Sales Funnel</h2>
        <p className={`text-sm ${tw.textSecondary}`}>No funnel data available</p>
      </div>
    )
  }

  // Filter only stages with data for funnel display
  const activeFunnel = funnel.filter(s => s.count > 0)
  const maxCount = Math.max(...funnel.map(s => s.count || 0), 1)

  const funnelOption = {
    backgroundColor: ct.bg,
    tooltip: {
      trigger: 'item',
      backgroundColor: ct.tooltip.backgroundColor,
      borderColor: ct.tooltip.borderColor,
      textStyle: ct.tooltip.textStyle,
      extraCssText: ct.tooltip.extraCssText,
      formatter: (params) => {
        const row = funnel.find(f => f.stage === params.name)
        return [
          `<b>${params.name}</b>`,
          `Opportunities: <b>${params.value}</b>`,
          `Fleet Size: <b>${formatFleet(row?.deal_size || 0)}</b> vehicles`,
          row?.conversion_pct != null ? `Stage Conv.: <b>${row.conversion_pct.toFixed(1)}%</b>` : '',
        ].filter(Boolean).join('<br/>')
      }
    },
    series: [{
      type: 'funnel',
      left: '10%',
      width: '80%',
      sort: 'none',
      gap: 4,
      label: {
        show: true,
        position: 'inside',
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
        formatter: (p) => `${p.name}: ${p.value}`,
      },
      itemStyle: { borderWidth: 0 },
      data: activeFunnel.map((s, i) => ({
        name: s.stage,
        value: s.count || 0,
        itemStyle: { color: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }
      }))
    }]
  }

  const dropoffOption = {
    backgroundColor: ct.bg,
    tooltip: {
      trigger: 'axis',
      backgroundColor: ct.tooltip.backgroundColor,
      borderColor: ct.tooltip.borderColor,
      textStyle: ct.tooltip.textStyle,
      extraCssText: ct.tooltip.extraCssText,
      formatter: (params) => {
        const p = params[0]
        const row = funnel[p.dataIndex]
        const conv = row?.conversion_pct
        return [
          `<b>${p.name}</b>`,
          `Opportunities: <b>${p.value}</b>`,
          `Fleet Size: <b>${formatFleet(row?.deal_size || 0)}</b> vehicles`,
          conv != null ? `Conv. from prev: <b>${conv.toFixed(1)}%</b>` : '',
        ].filter(Boolean).join('<br/>')
      }
    },
    grid: { left: '2%', right: '10%', top: '5%', bottom: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      max: maxCount,
      axisLine: { lineStyle: { color: ct.axisLine } },
      splitLine: { lineStyle: { color: ct.splitLine } },
      axisLabel: { color: ct.text, fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      data: funnel.map(s => s.stage),
      axisLine: { lineStyle: { color: ct.axisLine } },
      axisLabel: { color: ct.text, fontSize: 11 },
    },
    series: [{
      type: 'bar',
      data: funnel.map((s, i) => ({
        value: s.count || 0,
        itemStyle: { color: FUNNEL_COLORS[i % FUNNEL_COLORS.length], borderRadius: [0, 4, 4, 0] }
      })),
      label: {
        show: true,
        position: 'right',
        color: ct.text,
        fontSize: 10,
        formatter: (p) => {
          const row = funnel[p.dataIndex]
          const conv = row?.conversion_pct
          return conv != null ? `${p.value} (${conv.toFixed(0)}%)` : `${p.value}`
        }
      }
    }]
  }

  return (
    <div className={`${tw.card} rounded-xl p-5`}>
      <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>
        Sales Funnel & Drop-off Analysis
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className={`text-sm font-medium mb-3 ${tw.subTitle}`}>Funnel by Opportunities</h3>
          <ReactECharts option={funnelOption} style={{ height: '380px', width: '100%' }} />
        </div>
        <div>
          <h3 className={`text-sm font-medium mb-3 ${tw.subTitle}`}>Opportunities & Conversion %</h3>
          <ReactECharts option={dropoffOption} style={{ height: '380px', width: '100%' }} />
        </div>
      </div>

      {/* Conversion table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={tw.divider}>
              <th className={`text-left py-2 pr-4 font-medium ${tw.textSecondary}`}>Stage</th>
              <th className={`text-right py-2 px-3 font-medium ${tw.textSecondary}`}>Opportunities</th>
              <th className={`text-right py-2 px-3 font-medium ${tw.textSecondary}`}>Fleet Size (Vehicles)</th>
              <th className={`text-right py-2 pl-3 font-medium ${tw.textSecondary}`}>Stage-to-Stage Conv.</th>
            </tr>
          </thead>
          <tbody>
            {funnel.map((row, i) => (
              <tr key={i} className={`border-b ${tw.borderHalf} ${tw.hover}`}>
                <td className="py-2.5 pr-4">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} />
                    <span className={tw.textBody}>{row.stage}</span>
                  </span>
                </td>
                <td className={`text-right py-2.5 px-3 ${tw.textVal}`}>{row.count}</td>
                <td className={`text-right py-2.5 px-3 ${tw.textVal}`}>{formatFleet(row.deal_size)}</td>
                <td className="text-right py-2.5 pl-3">
                  {row.conversion_pct != null ? (
                    <span className={`font-medium ${row.conversion_pct >= 50 ? 'text-emerald-500' : row.conversion_pct >= 25 ? 'text-yellow-500' : 'text-red-500'}`}>
                      {row.conversion_pct.toFixed(1)}%
                    </span>
                  ) : (
                    <span className={tw.textMuted}>—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
