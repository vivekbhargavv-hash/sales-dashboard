import React from 'react'
import ReactECharts from 'echarts-for-react'
import { useTheme, formatFleet } from '../ThemeContext'

const MEDALS = ['🥇', '🥈', '🥉']

export default function TopClients({ topClients }) {
  const { tw, ct } = useTheme()

  if (!topClients || topClients.length === 0) {
    return (
      <div className={`${tw.card} rounded-xl p-5`}>
        <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>Top Clients</h2>
        <p className={`text-sm ${tw.textSecondary}`}>No client data available</p>
      </div>
    )
  }

  const totalVal = topClients.reduce((s, c) => s + (c.total_deal_size || 0), 0)
  let cumulative = 0
  const cumulativePcts = topClients.map(c => {
    cumulative += (c.total_deal_size || 0)
    return totalVal > 0 ? (cumulative / totalVal) * 100 : 0
  })

  const labels = topClients.map(c =>
    c.client_name.length > 14 ? c.client_name.slice(0, 12) + '…' : c.client_name
  )

  const paretoOption = {
    backgroundColor: ct.bg,
    tooltip: {
      trigger: 'axis',
      backgroundColor: ct.tooltip.backgroundColor,
      borderColor: ct.tooltip.borderColor,
      textStyle: ct.tooltip.textStyle,
      extraCssText: ct.tooltip.extraCssText,
      formatter: (params) => {
        const client = topClients[params[0]?.dataIndex]
        let out = `<b>${client?.client_name || ''}</b><br/>`
        params.forEach(p => {
          if (p.seriesType === 'bar') out += `Fleet Size: <b>${formatFleet(p.value)}</b> vehicles<br/>`
          if (p.seriesType === 'line') out += `Cumulative: <b>${p.value?.toFixed(1)}%</b><br/>`
        })
        return out
      }
    },
    legend: {
      data: ['Fleet Size', 'Cumulative %'],
      ...ct.legend,
      top: 0,
    },
    grid: { left: '2%', right: '8%', top: '12%', bottom: '8%', containLabel: true },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: ct.axisLine } },
      axisLabel: { color: ct.text, fontSize: 10, rotate: 25 },
    },
    yAxis: [
      {
        type: 'value',
        name: 'Fleet Size',
        nameTextStyle: { color: ct.text, fontSize: 10 },
        axisLine: { lineStyle: { color: ct.axisLine } },
        splitLine: { lineStyle: { color: ct.splitLine } },
        axisLabel: { color: ct.text, fontSize: 10, formatter: (v) => formatFleet(v) },
      },
      {
        type: 'value',
        name: 'Cumulative %',
        min: 0, max: 100,
        nameTextStyle: { color: ct.text, fontSize: 10 },
        axisLine: { lineStyle: { color: ct.axisLine } },
        splitLine: { show: false },
        axisLabel: { color: ct.text, fontSize: 10, formatter: (v) => `${v}%` },
      }
    ],
    series: [
      {
        name: 'Fleet Size',
        type: 'bar',
        data: topClients.map((c, i) => ({
          value: c.total_deal_size || 0,
          itemStyle: {
            color: i < 3 ? ['#f59e0b', '#94a3b8', '#cd7f32'][i] : '#3b82f6',
            borderRadius: [4, 4, 0, 0],
          }
        })),
        yAxisIndex: 0,
        label: {
          show: true,
          position: 'top',
          color: ct.text,
          fontSize: 9,
          formatter: (p) => formatFleet(p.value),
        }
      },
      {
        name: 'Cumulative %',
        type: 'line',
        data: cumulativePcts,
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#10b981', width: 2 },
        itemStyle: { color: '#10b981' },
        label: {
          show: true,
          color: '#10b981',
          fontSize: 9,
          formatter: (p) => `${p.value.toFixed(0)}%`,
          position: 'top',
        }
      }
    ]
  }

  return (
    <div className={`${tw.card} rounded-xl p-5`}>
      <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>
        Top Clients — Pareto Analysis
      </h2>

      <ReactECharts option={paretoOption} style={{ height: '350px', width: '100%' }} />

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={tw.divider}>
              <th className={`text-left py-2 pr-3 font-medium w-8 ${tw.textSecondary}`}>Rank</th>
              <th className={`text-left py-2 pr-3 font-medium ${tw.textSecondary}`}>Client</th>
              <th className={`text-right py-2 px-3 font-medium ${tw.textSecondary}`}>Total Fleet Size</th>
              <th className={`text-right py-2 px-3 font-medium ${tw.textSecondary}`}>Opportunities</th>
              <th className={`text-right py-2 pl-3 font-medium ${tw.textSecondary}`}>Avg Fleet Size</th>
            </tr>
          </thead>
          <tbody>
            {topClients.map((client, i) => (
              <tr key={i} className={`border-b ${tw.borderHalf} ${tw.hover}`}>
                <td className="py-2.5 pr-3 text-center">
                  {MEDALS[i] || <span className={`font-mono text-xs ${tw.textMuted}`}>{i + 1}</span>}
                </td>
                <td className={`py-2.5 pr-3 font-medium ${tw.textBody}`}>{client.client_name}</td>
                <td className={`text-right py-2.5 px-3 ${tw.textVal}`}>
                  {formatFleet(client.total_deal_size)}
                </td>
                <td className={`text-right py-2.5 px-3 ${tw.textVal}`}>{client.count}</td>
                <td className={`text-right py-2.5 pl-3 ${tw.textSecondary}`}>
                  {formatFleet(client.avg_deal_size)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
