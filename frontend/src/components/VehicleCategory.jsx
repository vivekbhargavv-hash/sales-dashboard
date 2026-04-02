import React from 'react'
import ReactECharts from 'echarts-for-react'
import { useTheme, formatFleet } from '../ThemeContext'

const CAT_COLORS = {
  'LCV': '#3b82f6',
  'SCV': '#22c55e',
  '3W L5': '#f59e0b',
  'Others': '#8b5cf6',
}

const CAT_BADGE_DARK = {
  'LCV': 'bg-blue-900/40 text-blue-300 border-blue-700/50',
  'SCV': 'bg-emerald-900/40 text-emerald-300 border-emerald-700/50',
  '3W L5': 'bg-yellow-900/40 text-yellow-300 border-yellow-700/50',
  'Others': 'bg-purple-900/40 text-purple-300 border-purple-700/50',
}

const CAT_BADGE_LIGHT = {
  'LCV': 'bg-blue-100 text-blue-700 border-blue-200',
  'SCV': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  '3W L5': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Others': 'bg-purple-100 text-purple-700 border-purple-200',
}

export default function VehicleCategory({ vehicleCategory }) {
  const { tw, ct, isDark } = useTheme()
  const badgeMap = isDark ? CAT_BADGE_DARK : CAT_BADGE_LIGHT

  if (!vehicleCategory || vehicleCategory.length === 0) {
    return (
      <div className={`${tw.card} rounded-xl p-5`}>
        <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>Vehicle Categories</h2>
        <p className={`text-sm ${tw.textSecondary}`}>No vehicle category data available</p>
      </div>
    )
  }

  const donutOption = {
    backgroundColor: ct.bg,
    tooltip: {
      trigger: 'item',
      backgroundColor: ct.tooltip.backgroundColor,
      borderColor: ct.tooltip.borderColor,
      textStyle: ct.tooltip.textStyle,
      extraCssText: ct.tooltip.extraCssText,
      formatter: (params) =>
        `<b>${params.name}</b><br/>Fleet Size: <b>${formatFleet(params.value)}</b> vehicles<br/>${params.percent?.toFixed(1)}% of total`
    },
    legend: {
      orient: 'vertical',
      right: '5%',
      top: 'center',
      ...ct.legend,
    },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['40%', '50%'],
      avoidLabelOverlap: false,
      label: {
        show: true,
        position: 'inside',
        color: '#fff',
        fontSize: 11,
        fontWeight: 'bold',
        formatter: (p) => p.percent > 5 ? `${p.percent?.toFixed(0)}%` : '',
      },
      data: vehicleCategory.map(vc => ({
        name: vc.vehicle_category,
        value: vc.total_deal_size || 0,
        itemStyle: { color: CAT_COLORS[vc.vehicle_category] || '#64748b' }
      }))
    }]
  }

  const countBarOption = {
    backgroundColor: ct.bg,
    tooltip: {
      trigger: 'axis',
      backgroundColor: ct.tooltip.backgroundColor,
      borderColor: ct.tooltip.borderColor,
      textStyle: ct.tooltip.textStyle,
      extraCssText: ct.tooltip.extraCssText,
      formatter: (params) => {
        const p = params[0]
        return `<b>${p.name}</b><br/>Opportunities: <b>${p.value}</b>`
      }
    },
    grid: { left: '2%', right: '10%', top: '5%', bottom: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: vehicleCategory.map(vc => vc.vehicle_category),
      axisLine: { lineStyle: { color: ct.axisLine } },
      axisLabel: { color: ct.text, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: ct.axisLine } },
      splitLine: { lineStyle: { color: ct.splitLine } },
      axisLabel: { color: ct.text, fontSize: 10 },
      minInterval: 1,
    },
    series: [{
      type: 'bar',
      data: vehicleCategory.map(vc => ({
        value: vc.count || 0,
        itemStyle: { color: CAT_COLORS[vc.vehicle_category] || '#64748b', borderRadius: [4, 4, 0, 0] }
      })),
      barMaxWidth: 60,
      label: {
        show: true,
        position: 'top',
        color: ct.text,
        fontSize: 11,
        formatter: (p) => p.value,
      }
    }]
  }

  return (
    <div className={`${tw.card} rounded-xl p-5`}>
      <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>
        Vehicle Categories
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className={`text-sm font-medium mb-3 ${tw.subTitle}`}>Fleet Size by Category</h3>
          <ReactECharts option={donutOption} style={{ height: '280px', width: '100%' }} />
        </div>
        <div>
          <h3 className={`text-sm font-medium mb-3 ${tw.subTitle}`}>Opportunities by Category</h3>
          <ReactECharts option={countBarOption} style={{ height: '280px', width: '100%' }} />
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={tw.divider}>
              <th className={`text-left py-2 pr-3 font-medium ${tw.textSecondary}`}>Category</th>
              <th className={`text-right py-2 px-3 font-medium ${tw.textSecondary}`}>Fleet Size (Vehicles)</th>
              <th className={`text-right py-2 px-3 font-medium ${tw.textSecondary}`}>Opportunities</th>
              <th className={`text-right py-2 pl-3 font-medium ${tw.textSecondary}`}>% of Total</th>
            </tr>
          </thead>
          <tbody>
            {vehicleCategory.map((row, i) => (
              <tr key={i} className={`border-b ${tw.borderHalf} ${tw.hover}`}>
                <td className="py-2.5 pr-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-medium ${badgeMap[row.vehicle_category] || (isDark ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-gray-100 text-gray-600 border-gray-300')}`}>
                    {row.vehicle_category}
                  </span>
                </td>
                <td className={`text-right py-2.5 px-3 ${tw.textVal}`}>{formatFleet(row.total_deal_size)}</td>
                <td className={`text-right py-2.5 px-3 ${tw.textVal}`}>{row.count}</td>
                <td className={`text-right py-2.5 pl-3 ${tw.textSecondary}`}>{(row.pct || 0).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
