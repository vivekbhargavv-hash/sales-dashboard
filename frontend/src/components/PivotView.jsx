import React, { useMemo } from 'react'
import { useTheme } from '../ThemeContext'

function fmt(v) {
  return Number(v || 0).toLocaleString('en-IN')
}

const REGION_DOT = {
  North: '#3b82f6',
  West:  '#8b5cf6',
  South: '#10b981',
  East:  '#f97316',
  Other: '#64748b',
}

export default function PivotView({ geoFleet }) {
  const { tw, isDark } = useTheme()

  // Sort: Region → City → Client → Vehicle
  const sorted = useMemo(() => {
    if (!geoFleet || geoFleet.length === 0) return []
    const order = ['North', 'West', 'South', 'East', 'Other']
    return [...geoFleet].sort((a, b) => {
      const ri = order.indexOf(a.region) - order.indexOf(b.region)
      if (ri !== 0) return ri
      const ci = (a.city || '').localeCompare(b.city || '')
      if (ci !== 0) return ci
      const cli = (a.client || '').localeCompare(b.client || '')
      if (cli !== 0) return cli
      return (a.vehicle_type || '').localeCompare(b.vehicle_type || '')
    })
  }, [geoFleet])

  const totalFleet   = useMemo(() => sorted.reduce((s, r) => s + (r.fleet || 0), 0), [sorted])
  const totalClients = useMemo(() => new Set(sorted.map(r => r.client)).size, [sorted])

  const altRow = isDark ? 'bg-slate-700/20' : 'bg-gray-50'

  if (sorted.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className={`text-sm ${tw.textSecondary}`}>No data for current filters</p>
      </div>
    )
  }

  const COLS = ['Region', 'City', 'Client', 'Vehicle', 'Stage', 'Source', 'Fleet']

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={`sticky top-0 z-10 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
          <tr className={tw.divider}>
            {COLS.map(col => (
              <th key={col}
                className={`py-3 px-4 text-xs font-semibold uppercase tracking-wide text-green-600
                  whitespace-nowrap ${col === 'Fleet' ? 'text-right' : 'text-left'}`}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => {
            const dot = REGION_DOT[row.region] || REGION_DOT.Other
            return (
              <tr key={i}
                className={`border-b ${tw.borderHalf} ${tw.rowHover} transition-colors ${i % 2 === 0 ? altRow : ''}`}>

                {/* Region */}
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: dot }} />
                    <span className={`text-sm font-medium ${tw.textBody}`}>{row.region || '—'}</span>
                  </span>
                </td>

                {/* City */}
                <td className={`py-2.5 px-4 ${tw.textSecondary} whitespace-nowrap`}>
                  {row.city || '—'}
                </td>

                {/* Client */}
                <td className={`py-2.5 px-4 font-medium ${tw.textBody} max-w-[180px] truncate`}>
                  {row.client || '—'}
                </td>

                {/* Vehicle */}
                <td className={`py-2.5 px-4 ${tw.textSecondary} whitespace-nowrap`}>
                  {row.vehicle_type || '—'}
                </td>

                {/* Stage */}
                <td className={`py-2.5 px-4 ${tw.textSecondary} whitespace-nowrap text-xs`}>
                  {row.stage || '—'}
                </td>

                {/* Source badge */}
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                    row.source === 'Deal'
                      ? 'bg-blue-500/15 text-blue-400'
                      : 'bg-emerald-500/15 text-emerald-500'
                  }`}>
                    {row.source || '—'}
                  </span>
                </td>

                {/* Fleet */}
                <td className={`py-2.5 px-4 text-right font-semibold tabular-nums ${tw.textVal} whitespace-nowrap`}>
                  {fmt(row.fleet)}
                </td>
              </tr>
            )
          })}
        </tbody>

        {/* ── Totals row ── */}
        <tfoot>
          <tr className={`border-t-2 ${tw.border} ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
            <td colSpan={4} className={`py-3 px-4 text-sm font-semibold ${tw.textSecondary}`}>
              Total — {sorted.length.toLocaleString('en-IN')} records · {totalClients.toLocaleString('en-IN')} unique clients
            </td>
            <td /><td />
            <td className={`py-3 px-4 text-right text-sm font-bold tabular-nums text-green-500`}>
              {fmt(totalFleet)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
