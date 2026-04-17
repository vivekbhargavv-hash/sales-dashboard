import React, { useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { useTheme, STAGE_COLORS, formatFleet } from '../ThemeContext'

export default function StageSummary({ stageSummary, title = '{title}' }) {
  const [sortField, setSortField] = useState('stage_order')
  const [sortDir, setSortDir] = useState('asc')
  const { tw, ct } = useTheme()

  if (!stageSummary || stageSummary.length === 0) {
    return (
      <div className={`${tw.card} rounded-xl p-5`}>
        <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>{title}</h2>
        <p className={`text-sm ${tw.textSecondary}`}>No stage data available</p>
      </div>
    )
  }

  const totalPipeline = stageSummary
    .filter(s => s.stage !== 'Closed Lost')
    .reduce((sum, s) => sum + (s.total_deal_size || 0), 0)

  // Chart ordered by STAGE_ORDER (already sorted in data)
  const option = {
    backgroundColor: ct.bg,
    tooltip: {
      trigger: 'axis',
      backgroundColor: ct.tooltip.backgroundColor,
      borderColor: ct.tooltip.borderColor,
      textStyle: ct.tooltip.textStyle,
      extraCssText: ct.tooltip.extraCssText,
      formatter: (params) => {
        const p = params[0]
        return `<b>${p.name}</b><br/>Fleet Size: <b>${formatFleet(p.value)}</b> vehicles<br/>Opportunities: <b>${stageSummary.find(s => s.stage === p.name)?.count || 0}</b>`
      }
    },
    grid: { left: '2%', right: '8%', top: '5%', bottom: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: ct.axisLine } },
      splitLine: { lineStyle: { color: ct.splitLine } },
      axisLabel: { color: ct.text, fontSize: 10, formatter: (v) => formatFleet(v) },
    },
    yAxis: {
      type: 'category',
      data: stageSummary.map(s => s.stage),
      axisLine: { lineStyle: { color: ct.axisLine } },
      axisLabel: { color: ct.text, fontSize: 11 },
    },
    series: [{
      type: 'bar',
      data: stageSummary.map(s => ({
        value: s.total_deal_size || 0,
        itemStyle: { color: STAGE_COLORS[s.stage] || '#64748b', borderRadius: [0, 4, 4, 0] }
      })),
      label: {
        show: true,
        position: 'right',
        color: ct.text,
        fontSize: 10,
        formatter: (p) => formatFleet(p.value),
      }
    }]
  }

  // Sorting for table
  const SORT_FIELDS = { stage: 'stage', count: 'count', total_deal_size: 'total_deal_size' }
  const sortedTable = [...stageSummary].sort((a, b) => {
    if (sortField === 'stage_order') return 0 // already in order
    const av = a[sortField] ?? 0
    const bv = b[sortField] ?? 0
    if (typeof av === 'string') return sortDir === 'desc' ? bv.localeCompare(av) : av.localeCompare(bv)
    return sortDir === 'desc' ? bv - av : av - bv
  })

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortField(field); setSortDir('desc') }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30" />
    return sortDir === 'desc'
      ? <ChevronDown className="w-3 h-3 text-blue-400" />
      : <ChevronUp className="w-3 h-3 text-blue-400" />
  }

  return (
    <div className={`${tw.card} rounded-xl p-5`}>
      <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>
        {title}
      </h2>

      <ReactECharts option={option} style={{ height: '300px', width: '100%' }} />

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={tw.divider}>
              <th
                className={`text-left py-2 pr-3 font-medium cursor-pointer hover:opacity-80 select-none ${tw.textSecondary}`}
                onClick={() => toggleSort('stage')}
              >
                <span className="flex items-center gap-1">Stage <SortIcon field="stage" /></span>
              </th>
              <th
                className={`text-right py-2 px-3 font-medium cursor-pointer hover:opacity-80 select-none ${tw.textSecondary}`}
                onClick={() => toggleSort('count')}
              >
                <span className="flex items-center justify-end gap-1">Opportunities <SortIcon field="count" /></span>
              </th>
              <th
                className={`text-right py-2 px-3 font-medium cursor-pointer hover:opacity-80 select-none ${tw.textSecondary}`}
                onClick={() => toggleSort('total_deal_size')}
              >
                <span className="flex items-center justify-end gap-1">Fleet Size <SortIcon field="total_deal_size" /></span>
              </th>
              <th className={`text-right py-2 pl-3 font-medium ${tw.textSecondary}`}>% Pipeline</th>
            </tr>
          </thead>
          <tbody>
            {sortedTable.map((row, i) => {
              const pct = totalPipeline > 0 && row.stage !== 'Closed Lost'
                ? (row.total_deal_size / totalPipeline * 100).toFixed(1)
                : '—'
              return (
                <tr key={i} className={`border-b ${tw.borderHalf} ${tw.hover} transition-colors`}>
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: STAGE_COLORS[row.stage] || '#64748b' }} />
                      <span className={tw.textBody}>{row.stage}</span>
                    </span>
                  </td>
                  <td className={`text-right py-2.5 px-3 ${tw.textVal}`}>{row.count}</td>
                  <td className={`text-right py-2.5 px-3 ${tw.textVal}`}>{formatFleet(row.total_deal_size)}</td>
                  <td className={`text-right py-2.5 pl-3 ${tw.textSecondary}`}>{pct !== '—' ? `${pct}%` : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
