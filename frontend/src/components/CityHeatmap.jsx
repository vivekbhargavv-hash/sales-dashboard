import React from 'react'
import ReactECharts from 'echarts-for-react'
import { useTheme, formatFleet } from '../ThemeContext'

export default function CityHeatmap({ cityHeatmap }) {
  const { tw, ct } = useTheme()

  if (!cityHeatmap || cityHeatmap.length === 0) {
    return (
      <div className={`${tw.card} rounded-xl p-5`}>
        <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>City Distribution</h2>
        <p className={`text-sm ${tw.textSecondary}`}>No city data available (requires Closed Won or Pending Deployment records)</p>
      </div>
    )
  }

  const top15 = cityHeatmap.slice(0, 15)
  const maxCount = Math.max(...cityHeatmap.map(c => c.count || 0), 1)

  const treemapOption = {
    backgroundColor: ct.bg,
    tooltip: {
      trigger: 'item',
      backgroundColor: ct.tooltip.backgroundColor,
      borderColor: ct.tooltip.borderColor,
      textStyle: ct.tooltip.textStyle,
      extraCssText: ct.tooltip.extraCssText,
      formatter: (params) => {
        const d = params.data
        return [
          `<b>${d.name}</b>`,
          `Fleet Size: <b>${formatFleet(d.value)}</b> vehicles`,
          `Opportunities: <b>${d.count}</b>`,
        ].join('<br/>')
      }
    },
    series: [{
      type: 'treemap',
      width: '100%',
      height: '100%',
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: {
        show: true,
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
        formatter: (params) => `${params.name}\n${formatFleet(params.value)} v`,
      },
      itemStyle: {
        borderColor: ct.bg === 'transparent' ? '#0f172a' : '#f8fafc',
        borderWidth: 2,
        gapWidth: 2,
      },
      levels: [{ itemStyle: { borderWidth: 0, gapWidth: 4 }, upperLabel: { show: false } }],
      data: cityHeatmap.map((c) => {
        const intensity = (c.count || 0) / maxCount
        // Blend from blue → green based on intensity
        const r = Math.round(59 + intensity * (34 - 59))
        const g = Math.round(130 + intensity * (197 - 130))
        const b = Math.round(246 + intensity * (94 - 246))
        return {
          name: c.city,
          value: c.total_deal_size || 0,
          count: c.count || 0,
          itemStyle: { color: `rgb(${r},${g},${b})` }
        }
      })
    }]
  }

  const barOption = {
    backgroundColor: ct.bg,
    tooltip: {
      trigger: 'axis',
      backgroundColor: ct.tooltip.backgroundColor,
      borderColor: ct.tooltip.borderColor,
      textStyle: ct.tooltip.textStyle,
      extraCssText: ct.tooltip.extraCssText,
      formatter: (params) => {
        const p = params[0]
        const city = top15[p.dataIndex]
        return [
          `<b>${p.name}</b>`,
          `Fleet Size: <b>${formatFleet(p.value)}</b> vehicles`,
          `Opportunities: <b>${city?.count || 0}</b>`,
        ].join('<br/>')
      }
    },
    grid: { left: '2%', right: '12%', top: '3%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: ct.axisLine } },
      splitLine: { lineStyle: { color: ct.splitLine } },
      axisLabel: { color: ct.text, fontSize: 10, formatter: (v) => formatFleet(v) },
    },
    yAxis: {
      type: 'category',
      data: top15.map(c => c.city),
      axisLine: { lineStyle: { color: ct.axisLine } },
      axisLabel: { color: ct.text, fontSize: 11 },
    },
    visualMap: {
      show: false,
      min: 0,
      max: Math.max(...top15.map(c => c.total_deal_size || 0), 1),
      inRange: { color: ['#3b82f6', '#22c55e'] }
    },
    series: [{
      type: 'bar',
      data: top15.map(c => c.total_deal_size || 0),
      itemStyle: { borderRadius: [0, 4, 4, 0] },
      label: {
        show: true,
        position: 'right',
        color: ct.text,
        fontSize: 10,
        formatter: (p) => formatFleet(p.value),
      }
    }]
  }

  return (
    <div className={`${tw.card} rounded-xl p-5`}>
      <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>
        City Distribution — Closed Won & Pending Deployment
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className={`text-sm font-medium mb-3 ${tw.subTitle}`}>City Treemap (sized by fleet)</h3>
          <ReactECharts option={treemapOption} style={{ height: '360px', width: '100%' }} />
        </div>
        <div>
          <h3 className={`text-sm font-medium mb-3 ${tw.subTitle}`}>Top 15 Cities by Fleet Size</h3>
          <ReactECharts option={barOption} style={{ height: '360px', width: '100%' }} />
        </div>
      </div>

      {/* City table */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={tw.divider}>
              <th className={`text-left py-2 pr-3 font-medium ${tw.textSecondary}`}>City</th>
              <th className={`text-right py-2 px-3 font-medium ${tw.textSecondary}`}>Fleet Size (Vehicles)</th>
              <th className={`text-right py-2 pl-3 font-medium ${tw.textSecondary}`}>Opportunities</th>
            </tr>
          </thead>
          <tbody>
            {cityHeatmap.map((row, i) => (
              <tr key={i} className={`border-b ${tw.borderHalf} ${tw.hover}`}>
                <td className={`py-2.5 pr-3 ${tw.textBody}`}>{row.city}</td>
                <td className={`text-right py-2.5 px-3 ${tw.textVal}`}>{formatFleet(row.total_deal_size)}</td>
                <td className={`text-right py-2.5 pl-3 ${tw.textSecondary}`}>{row.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
