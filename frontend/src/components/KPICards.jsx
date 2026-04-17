import React from 'react'
import { TrendingUp, Truck, Clock, Target, Timer, Percent, Activity, Award } from 'lucide-react'
import { useTheme, formatFleet, formatNum } from '../ThemeContext'

export { formatFleet, formatNum }

const CARDS = [
  {
    key: 'total_pipeline_value',
    title: 'Total Pipeline Fleet',
    icon: TrendingUp,
    border: 'border-l-blue-500',
    iconBg: 'bg-blue-500/10',
    iconColor: 'text-blue-400',
    format: (v) => formatFleet(v),
    unit: 'vehicles',
    context: 'Deals + Pending Projects',
  },
  {
    key: 'total_closed_won',
    title: 'Closed Won Fleet',
    icon: Award,
    border: 'border-l-emerald-500',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-400',
    format: (v) => formatFleet(v),
    unit: 'vehicles',
    context: 'Confirmed fleet',
  },
  {
    key: 'total_pending_deployment',
    title: 'Pending Deployment',
    icon: Truck,
    border: 'border-l-purple-500',
    iconBg: 'bg-purple-500/10',
    iconColor: 'text-purple-400',
    format: (v) => formatFleet(v),
    unit: 'vehicles',
    context: 'Awaiting rollout',
  },
  {
    key: 'total_opportunities',
    title: 'Total Opportunities',
    icon: Target,
    border: 'border-l-orange-500',
    iconBg: 'bg-orange-500/10',
    iconColor: 'text-orange-400',
    format: (v) => formatNum(v),
    unit: 'opps',
    context: 'Deals + new projects',
  },
  {
    key: 'avg_tat_days',
    title: 'Avg TAT',
    icon: Timer,
    border: 'border-l-teal-500',
    iconBg: 'bg-teal-500/10',
    iconColor: 'text-teal-400',
    format: (v) => v ? `${Math.round(v)}d` : '—',
    unit: 'days',
    context: 'Close Date − Created',
  },
  {
    key: 'avg_margin_percent',
    title: 'Avg Margin %',
    icon: Percent,
    border: 'border-l-pink-500',
    iconBg: 'bg-pink-500/10',
    iconColor: 'text-pink-400',
    format: (v) => v != null && v !== 0 ? `${(+v).toFixed(1)}%` : '—',
    unit: null,
    context: '(Quote − Cost) / Quote',
  },
  {
    key: 'win_rate',
    title: 'Win Rate',
    icon: Activity,
    border: 'border-l-yellow-500',
    iconBg: 'bg-yellow-500/10',
    iconColor: 'text-yellow-400',
    format: (v) => `${(v || 0).toFixed(1)}%`,
    unit: null,
    context: 'Closed Won / Total',
  },
]

export default function KPICards({ kpis }) {
  const { tw } = useTheme()
  if (!kpis) return null

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {CARDS.map(card => {
        const Icon = card.icon
        const value = kpis[card.key]
        return (
          <div
            key={card.key}
            className={`${tw.card} rounded-xl p-4 border-l-4 ${card.border}
              hover:scale-[1.02] hover:shadow-lg transition-all duration-200 cursor-default`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${card.iconBg}`}>
                <Icon className={`w-4 h-4 ${card.iconColor}`} />
              </div>
            </div>
            <p className={`text-xs font-medium leading-tight mb-1 ${tw.textSecondary}`}>
              {card.title}
            </p>
            <p className={`text-xl font-bold leading-tight ${tw.textPrimary}`}>
              {card.format(value)}
            </p>
            {card.unit && (
              <p className={`text-xs mt-0.5 ${tw.textMuted}`}>{card.unit}</p>
            )}
            <p className={`text-xs mt-1 ${tw.textMuted}`}>{card.context}</p>
          </div>
        )
      })}
    </div>
  )
}
