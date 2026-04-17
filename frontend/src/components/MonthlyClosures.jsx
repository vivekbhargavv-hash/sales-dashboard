import React, { useMemo } from 'react'
import { useTheme } from '../ThemeContext'

export default function MonthlyClosures({ monthlyClosures, monthlySummary }) {
  const { tw, isDark } = useTheme()

  // Sort: by month_key order (backend already sorts, but keep stable)
  const sortedClosures = useMemo(() => {
    if (!monthlyClosures || monthlyClosures.length === 0) return []
    return [...monthlyClosures]
  }, [monthlyClosures])

  // Track first row per month for the merge-cell effect
  const rowsWithMonth = useMemo(() => {
    const seen = new Set()
    return sortedClosures.map(row => {
      const isFirst = !seen.has(row.month)
      seen.add(row.month)
      return { ...row, showMonth: isFirst }
    })
  }, [sortedClosures])

  const altRow = isDark ? 'bg-slate-700/20' : 'bg-gray-50'

  return (
    <div className="space-y-6">

      {/* ── Section 1: Monthly Summary Cards ── */}
      {monthlySummary && monthlySummary.length > 0 && (
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-3 min-w-max">
            {monthlySummary.map((item) => (
              <div key={item.month} className={`${tw.card} rounded-xl px-5 py-4 min-w-[140px] flex-shrink-0`}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${tw.textSecondary}`}>
                  {item.month}
                </p>
                <div className="space-y-1.5">
                  <div>
                    <p className={`text-[11px] ${tw.textMuted}`}>Records</p>
                    <p className={`text-xl font-bold leading-tight ${tw.textPrimary}`}>
                      {item.total_deals ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className={`text-[11px] ${tw.textMuted}`}>Vehicles</p>
                    <p className="text-xl font-bold leading-tight text-green-500">
                      {(item.total_vehicles ?? 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Section 2: Detailed Table ── */}
      <div className={`${tw.card} rounded-xl overflow-hidden`}>
        <div className="overflow-x-auto">
          {sortedClosures.length === 0 ? (
            <div className="py-16 text-center">
              <p className={`text-sm ${tw.textSecondary}`}>No data available</p>
              <p className={`text-xs mt-1 ${tw.textMuted}`}>
                Upload data with Closed Won deals or Pending Deployment projects
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className={tw.divider}>
                  {['Month', 'Client', 'SPOC', 'Vehicles', 'Source'].map(label => (
                    <th
                      key={label}
                      className={`py-3 px-4 text-xs font-semibold uppercase tracking-wide text-green-600 whitespace-nowrap
                        ${label === 'Vehicles' ? 'text-right' : 'text-left'}`}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rowsWithMonth.map((row, i) => (
                  <tr
                    key={i}
                    className={`${tw.rowHover} transition-colors duration-100
                      ${i % 2 === 0 ? altRow : ''}
                      ${row.showMonth && i !== 0 ? `border-t ${tw.border}` : ''}`}
                  >
                    {/* Month — show only on first row of group */}
                    <td className={`py-2.5 px-4 whitespace-nowrap font-medium ${
                      row.showMonth ? tw.textBody : 'text-transparent select-none'
                    }`}>
                      {row.showMonth ? row.month : '·'}
                    </td>

                    <td className={`py-2.5 px-4 ${tw.textBody}`}>
                      {row.client || '—'}
                    </td>

                    <td className={`py-2.5 px-4 ${tw.textSecondary}`}>
                      {row.spoc || '—'}
                    </td>

                    <td className="py-2.5 px-4 text-right font-medium text-green-500 tabular-nums">
                      {(row.vehicles ?? 0).toLocaleString('en-IN')}
                    </td>

                    {/* Source badge */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        row.source === 'Deal'
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-green-500/15 text-green-500'
                      }`}>
                        {row.source || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
