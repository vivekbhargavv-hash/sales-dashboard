import React from 'react'
import ReactECharts from 'echarts-for-react'
import { AlertTriangle, CheckCircle, AlertCircle } from 'lucide-react'
import { useTheme, formatFleet } from '../ThemeContext'

function getRiskLevel(pct) {
  if (pct >= 70) return {
    label: 'High Risk', color: '#ef4444',
    bg: 'bg-red-500/10', border: 'border-red-500/30', Icon: AlertTriangle
  }
  if (pct >= 50) return {
    label: 'Medium Risk', color: '#f59e0b',
    bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', Icon: AlertCircle
  }
  return {
    label: 'Low Risk', color: '#22c55e',
    bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', Icon: CheckCircle
  }
}

const COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ef4444', '#334155']

export default function ConcentrationRisk({ concentrationRisk }) {
  const { tw, ct } = useTheme()

  if (!concentrationRisk) {
    return (
      <div className={`${tw.card} rounded-xl p-5`}>
        <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>Concentration Risk</h2>
        <p className={`text-sm ${tw.textSecondary}`}>No concentration data available</p>
      </div>
    )
  }

  const top5pct = concentrationRisk.top5_pct || 0
  const top10pct = concentrationRisk.top10_pct || 0
  const risk5 = getRiskLevel(top5pct)
  const risk10 = getRiskLevel(top10pct)

  const top5Clients = concentrationRisk.top5_clients || []
  const totalVal = top5pct > 0
    ? top5Clients.reduce((s, c) => s + (c.value || 0), 0) / (top5pct / 100)
    : 0
  const othersValue = Math.max(0, totalVal - top5Clients.reduce((s, c) => s + (c.value || 0), 0))

  const donutData = [
    ...top5Clients.map((c, i) => ({
      name: c.client_name.length > 16 ? c.client_name.slice(0, 14) + '…' : c.client_name,
      value: c.value || 0,
      itemStyle: { color: COLORS[i] }
    })),
    { name: 'Others', value: othersValue, itemStyle: { color: '#475569' } }
  ]

  const donutOption = {
    backgroundColor: ct.bg,
    tooltip: {
      trigger: 'item',
      backgroundColor: ct.tooltip.backgroundColor,
      borderColor: ct.tooltip.borderColor,
      textStyle: ct.tooltip.textStyle,
      extraCssText: ct.tooltip.extraCssText,
      formatter: (params) =>
        `<b>${params.name}</b><br/>Fleet Size: <b>${formatFleet(params.value)}</b> vehicles<br/>${params.percent?.toFixed(1)}% of pipeline`
    },
    legend: {
      orient: 'vertical',
      right: '3%',
      top: 'center',
      ...ct.legend,
      formatter: (name) => name.length > 18 ? name.slice(0, 16) + '…' : name,
    },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['38%', '50%'],
      label: {
        show: true,
        position: 'inside',
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        formatter: (p) => p.percent > 5 ? `${p.percent?.toFixed(0)}%` : '',
      },
      data: donutData
    }]
  }

  const riskText = top5pct >= 70
    ? `High concentration risk: Top 5 clients account for ${top5pct.toFixed(1)}% of pipeline. Diversification strongly recommended.`
    : top5pct >= 50
    ? `Moderate concentration: Top 5 clients represent ${top5pct.toFixed(1)}% of pipeline. Monitor client health closely.`
    : `Healthy diversification: Top 5 clients represent ${top5pct.toFixed(1)}% — well-distributed pipeline.`

  return (
    <div className={`${tw.card} rounded-xl p-5`}>
      <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>
        Concentration Risk
      </h2>

      {/* Risk cards */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        {[{ risk: risk5, pct: top5pct, label: 'Top 5 Concentration' }, { risk: risk10, pct: top10pct, label: 'Top 10 Concentration' }].map(({ risk, pct, label }) => (
          <div key={label} className={`${risk.bg} border ${risk.border} rounded-xl p-4`}>
            <div className="flex items-center gap-2 mb-2">
              <risk.Icon className="w-4 h-4" style={{ color: risk.color }} />
              <span className={`text-sm font-medium ${tw.textBody}`}>{label}</span>
            </div>
            <p className="text-3xl font-bold" style={{ color: risk.color }}>{pct.toFixed(1)}%</p>
            <p className="text-xs mt-1 font-medium" style={{ color: risk.color }}>{risk.label}</p>
          </div>
        ))}
      </div>

      <ReactECharts option={donutOption} style={{ height: '240px', width: '100%' }} />

      {/* Risk text */}
      <div className={`mt-4 p-3 rounded-lg ${risk5.bg} border ${risk5.border}`}>
        <p className="text-sm" style={{ color: risk5.color }}>{riskText}</p>
      </div>

      {/* Top clients table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={tw.divider}>
              <th className={`text-left py-2 pr-3 font-medium ${tw.textSecondary}`}>Client</th>
              <th className={`text-right py-2 px-3 font-medium ${tw.textSecondary}`}>Fleet Size</th>
              <th className={`text-right py-2 pl-3 font-medium ${tw.textSecondary}`}>% of Pipeline</th>
            </tr>
          </thead>
          <tbody>
            {(concentrationRisk.top10_clients || []).map((client, i) => (
              <tr key={i} className={`border-b ${tw.borderHalf} ${tw.hover}`}>
                <td className="py-2.5 pr-3">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: COLORS[i] || '#334155' }} />
                    <span className={tw.textBody}>{client.client_name}</span>
                  </span>
                </td>
                <td className={`text-right py-2.5 px-3 ${tw.textVal}`}>{formatFleet(client.value)}</td>
                <td className={`text-right py-2.5 pl-3 ${tw.textSecondary}`}>{(client.pct || 0).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
