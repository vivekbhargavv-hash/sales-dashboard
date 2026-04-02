import React from 'react'
import ReactECharts from 'echarts-for-react'
import { useTheme, STAGE_ORDER, sortByStageOrder, formatFleet } from '../ThemeContext'

const PROB_COLORS = { high: '#10b981', medium: '#f59e0b', low: '#ef4444', zero: '#475569' }

function getProbColor(prob) {
  if (prob >= 0.75) return PROB_COLORS.high
  if (prob >= 0.3) return PROB_COLORS.medium
  if (prob > 0) return PROB_COLORS.low
  return PROB_COLORS.zero
}

export default function PipelineForecast({ forecast }) {
  const { tw, ct } = useTheme()

  if (!forecast || !forecast.stages) {
    return (
      <div className={`${tw.card} rounded-xl p-5`}>
        <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>Pipeline Forecast</h2>
        <p className={`text-sm ${tw.textSecondary}`}>No forecast data available</p>
      </div>
    )
  }

  const orderedStages = sortByStageOrder(forecast.stages)
  const activeStages = orderedStages.filter(s => s.stage !== 'Closed Lost' && s.count > 0)

  const stackedOption = {
    backgroundColor: ct.bg,
    tooltip: {
      trigger: 'axis',
      backgroundColor: ct.tooltip.backgroundColor,
      borderColor: ct.tooltip.borderColor,
      textStyle: ct.tooltip.textStyle,
      extraCssText: ct.tooltip.extraCssText,
      formatter: (params) => {
        let html = `<b>${params[0]?.axisValue}</b><br/>`
        params.forEach(p => {
          html += `${p.seriesName}: <b>${formatFleet(p.value)}</b> vehicles<br/>`
        })
        return html
      }
    },
    legend: {
      data: ['Raw Fleet Size', 'Weighted Fleet Size'],
      ...ct.legend,
      top: 0,
    },
    grid: { left: '2%', right: '3%', top: '12%', bottom: '5%', containLabel: true },
    xAxis: {
      type: 'category',
      data: activeStages.map(s => s.stage),
      axisLine: { lineStyle: { color: ct.axisLine } },
      axisLabel: { color: ct.text, fontSize: 10, rotate: 25 },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: ct.axisLine } },
      splitLine: { lineStyle: { color: ct.splitLine } },
      axisLabel: { color: ct.text, fontSize: 10, formatter: (v) => formatFleet(v) },
    },
    series: [
      {
        name: 'Raw Fleet Size',
        type: 'bar',
        data: activeStages.map(s => ({
          value: s.raw_value || 0,
          itemStyle: { color: '#3b82f640' }
        })),
        barGap: '-100%',
        barMaxWidth: 48,
      },
      {
        name: 'Weighted Fleet Size',
        type: 'bar',
        data: activeStages.map(s => ({
          value: s.weighted_value || 0,
          itemStyle: { color: getProbColor(s.probability || 0), borderRadius: [4, 4, 0, 0] }
        })),
        barMaxWidth: 48,
        label: {
          show: true,
          position: 'top',
          color: ct.text,
          fontSize: 9,
          formatter: (p) => formatFleet(p.value),
        }
      }
    ]
  }

  return (
    <div className={`${tw.card} rounded-xl p-5`}>
      <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>
        Pipeline Forecast
      </h2>

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-600/20 to-blue-500/10 border border-blue-500/30 rounded-xl p-5 text-center">
          <p className="text-blue-400 text-sm font-medium mb-1">Expected Fleet (Weighted)</p>
          <p className={`text-3xl font-bold ${tw.textPrimary}`}>{formatFleet(forecast.expected_revenue)}</p>
          <p className="text-blue-400 text-xs mt-1">vehicles — probability-adjusted</p>
        </div>
        <div className="bg-gradient-to-br from-purple-600/20 to-purple-500/10 border border-purple-500/30 rounded-xl p-5 text-center">
          <p className="text-purple-400 text-sm font-medium mb-1">Total Weighted Pipeline</p>
          <p className={`text-3xl font-bold ${tw.textPrimary}`}>{formatFleet(forecast.total_weighted)}</p>
          <p className="text-purple-400 text-xs mt-1">vehicles — all stages</p>
        </div>
      </div>

      <ReactECharts option={stackedOption} style={{ height: '300px', width: '100%' }} />

      {/* Stage probability table */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={tw.divider}>
              <th className={`text-left py-2 pr-3 font-medium ${tw.textSecondary}`}>Stage</th>
              <th className={`text-right py-2 px-3 font-medium ${tw.textSecondary}`}>Opportunities</th>
              <th className={`text-right py-2 px-3 font-medium ${tw.textSecondary}`}>Raw Fleet Size</th>
              <th className={`text-right py-2 px-3 font-medium ${tw.textSecondary}`}>Probability</th>
              <th className={`text-right py-2 pl-3 font-medium ${tw.textSecondary}`}>Weighted Fleet Size</th>
            </tr>
          </thead>
          <tbody>
            {orderedStages.map((row, i) => (
              <tr key={i} className={`border-b ${tw.borderHalf} ${tw.hover}`}>
                <td className={`py-2.5 pr-3 ${tw.textBody}`}>{row.stage}</td>
                <td className={`text-right py-2.5 px-3 ${tw.textVal}`}>{row.count}</td>
                <td className={`text-right py-2.5 px-3 ${tw.textVal}`}>{formatFleet(row.raw_value)}</td>
                <td className="text-right py-2.5 px-3">
                  <span
                    className="px-2 py-0.5 rounded text-xs font-bold"
                    style={{
                      background: `${getProbColor(row.probability || 0)}20`,
                      color: getProbColor(row.probability || 0)
                    }}
                  >
                    {((row.probability || 0) * 100).toFixed(0)}%
                  </span>
                </td>
                <td
                  className="text-right py-2.5 pl-3 font-medium"
                  style={{ color: getProbColor(row.probability || 0) }}
                >
                  {formatFleet(row.weighted_value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
