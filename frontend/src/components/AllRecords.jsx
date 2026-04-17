import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useTheme } from '../ThemeContext'
import { ChevronDown, X, Calendar } from 'lucide-react'

// ── Multi-select dropdown ─────────────────────────────────────────────────────

function MultiSelectDropdown({ label, options, selected, onChange, tw }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const count = selected.size
  const active = count > 0

  function toggle(val) {
    const next = new Set(selected)
    next.has(val) ? next.delete(val) : next.add(val)
    onChange(next)
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors
          ${active ? tw.filterBtnActive : tw.filterBtn}`}
      >
        <span>{label}</span>
        {active && (
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${tw.filterBadge}`}>
            {count}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''} ${active ? '' : tw.textMuted}`} />
      </button>

      {open && (
        <div className={`absolute z-50 top-full mt-1.5 left-0 min-w-[180px] max-h-64 overflow-y-auto
          rounded-xl shadow-2xl ${tw.filterDropdown}`}>
          <div className={`flex items-center justify-between px-3 py-2 border-b ${tw.borderHalf}`}>
            <span className={`text-xs font-semibold uppercase tracking-wide ${tw.textSecondary}`}>{label}</span>
            {active && (
              <button onClick={() => onChange(new Set())}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors">
                <X className="w-3 h-3" />Clear
              </button>
            )}
          </div>
          <div className="py-1">
            {options.map(opt => (
              <label key={opt}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer ${tw.filterOption} transition-colors`}>
                <input type="checkbox" checked={selected.has(opt)} onChange={() => toggle(opt)}
                  className="w-3.5 h-3.5 accent-green-500 cursor-pointer flex-shrink-0" />
                <span className={`text-sm truncate ${tw.filterOptionText}`}>{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Date range picker ─────────────────────────────────────────────────────────

const DATE_RANGES = [
  { label: 'All time', days: null },
  { label: 'Last 7d',  days: 7   },
  { label: 'Last 30d', days: 30  },
  { label: 'Last 90d', days: 90  },
]

function DateRangePicker({ value, onChange, tw, isDark }) {
  return (
    <div className={`flex items-center gap-1 rounded-lg border p-1 ${isDark ? 'border-slate-700 bg-slate-800' : 'border-gray-200 bg-gray-50'}`}>
      <Calendar className={`w-3.5 h-3.5 ml-1 flex-shrink-0 ${tw.textMuted}`} />
      {DATE_RANGES.map(r => (
        <button
          key={r.label}
          onClick={() => onChange(r.days)}
          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
            value === r.days
              ? 'bg-green-500 text-white'
              : `${tw.textSecondary} hover:${isDark ? 'bg-slate-700' : 'bg-gray-200'}`
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtNum(v) {
  if (v == null || v === 0) return '—'
  return Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

function fmtMarginPct(v) {
  if (v == null) return '—'
  return `${(+v).toFixed(1)}%`
}

function parseRecordDate(s) {
  if (!s) return null
  try {
    return new Date(s.replace(' ', 'T') + ':00')
  } catch {
    return null
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AllRecords({ combinedRecords }) {
  const { tw, isDark } = useTheme()

  const [selectedTypes,  setSelectedTypes]  = useState(new Set())
  const [selectedStages, setSelectedStages] = useState(new Set())
  const [selectedCities, setSelectedCities] = useState(new Set())
  const [selectedSpocs,  setSelectedSpocs]  = useState(new Set())
  const [dateDays,       setDateDays]       = useState(null)

  const { typeOptions, stageOptions, cityOptions, spocOptions } = useMemo(() => {
    if (!combinedRecords?.length)
      return { typeOptions: [], stageOptions: [], cityOptions: [], spocOptions: [] }
    const unique = key => [...new Set(combinedRecords.map(r => r[key]).filter(Boolean))].sort()
    return {
      typeOptions:  [...new Set(combinedRecords.map(r => r.type).filter(Boolean))].sort(),
      stageOptions: unique('stage'),
      cityOptions:  unique('city'),
      spocOptions:  unique('spoc'),
    }
  }, [combinedRecords])

  const cutoff = useMemo(() => {
    if (!dateDays) return null
    const d = new Date()
    d.setDate(d.getDate() - dateDays)
    return d
  }, [dateDays])

  const filteredRecords = useMemo(() => {
    if (!combinedRecords) return []
    return combinedRecords.filter(r => {
      if (selectedTypes.size  > 0 && !selectedTypes.has(r.type))   return false
      if (selectedStages.size > 0 && !selectedStages.has(r.stage)) return false
      if (selectedCities.size > 0 && !selectedCities.has(r.city))  return false
      if (selectedSpocs.size  > 0 && !selectedSpocs.has(r.spoc))   return false
      if (cutoff) {
        const d = parseRecordDate(r.date)
        if (!d || d < cutoff) return false
      }
      return true
    })
  }, [combinedRecords, selectedTypes, selectedStages, selectedCities, selectedSpocs, cutoff])

  const total   = combinedRecords?.length ?? 0
  const showing = filteredRecords.length
  const altRow  = isDark ? 'bg-slate-700/20' : 'bg-gray-50'

  if (!combinedRecords?.length) {
    return (
      <div className={`${tw.card} rounded-xl p-8 text-center`}>
        <p className={`text-sm ${tw.textSecondary}`}>No records available</p>
      </div>
    )
  }

  const COLUMNS = [
    { label: 'Type',           align: 'left'  },
    { label: 'Name',           align: 'left'  },
    { label: 'Client',         align: 'left'  },
    { label: 'Stage',          align: 'left'  },
    { label: 'City',           align: 'left'  },
    { label: 'Vehicle',        align: 'left'  },
    { label: 'Fleet',          align: 'right' },
    { label: 'SPOC',           align: 'left'  },
    { label: 'Driver Type',    align: 'left'  },
    { label: 'Charging Scope', align: 'left'  },
    { label: 'Quote',          align: 'right' },
    { label: 'Total Cost',     align: 'right' },
    { label: 'Margin',         align: 'right' },
    { label: 'Margin %',       align: 'right' },
    { label: 'Last Updated',   align: 'left'  },
  ]

  return (
    <div className="space-y-4">

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectDropdown label="Type"  options={typeOptions}  selected={selectedTypes}  onChange={setSelectedTypes}  tw={tw} isDark={isDark} />
        <MultiSelectDropdown label="Stage" options={stageOptions} selected={selectedStages} onChange={setSelectedStages} tw={tw} isDark={isDark} />
        <MultiSelectDropdown label="City"  options={cityOptions}  selected={selectedCities} onChange={setSelectedCities} tw={tw} isDark={isDark} />
        <MultiSelectDropdown label="SPOC"  options={spocOptions}  selected={selectedSpocs}  onChange={setSelectedSpocs}  tw={tw} isDark={isDark} />

        <DateRangePicker value={dateDays} onChange={setDateDays} tw={tw} isDark={isDark} />

        <span className={`ml-auto text-xs font-medium ${tw.textMuted} whitespace-nowrap`}>
          Showing{' '}
          <span className={tw.textSecondary}>{showing.toLocaleString('en-IN')}</span>
          {' '}of{' '}
          <span className={tw.textSecondary}>{total.toLocaleString('en-IN')}</span>
          {' '}records
        </span>
      </div>

      {/* ── Table ── */}
      <div className={`${tw.card} rounded-xl overflow-hidden`}>
        <div className="overflow-x-auto">
          {filteredRecords.length === 0 ? (
            <div className="py-16 text-center">
              <p className={`text-sm ${tw.textSecondary}`}>No records match your filters</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className={`sticky top-0 z-10 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                <tr className={tw.divider}>
                  {COLUMNS.map(col => (
                    <th key={col.label}
                      className={`py-3 px-4 text-xs font-semibold uppercase tracking-wide text-green-600
                        whitespace-nowrap text-${col.align}`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((row, i) => (
                  <tr key={i}
                    className={`${tw.rowHover} transition-colors duration-100
                      ${i % 2 === 0 ? altRow : ''} border-b ${tw.borderHalf}`}>

                    {/* Type badge */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                        row.type === 'Deal'
                          ? 'bg-blue-500/15 text-blue-400'
                          : 'bg-green-500/15 text-green-500'
                      }`}>
                        {row.type || '—'}
                      </span>
                    </td>

                    <td className={`py-2.5 px-4 font-medium ${tw.textBody} max-w-[180px] truncate`}>
                      {row.name || '—'}
                    </td>

                    <td className={`py-2.5 px-4 ${tw.textSecondary} whitespace-nowrap`}>
                      {row.client || '—'}
                    </td>

                    <td className={`py-2.5 px-4 ${tw.textSecondary} whitespace-nowrap`}>
                      {row.stage || '—'}
                    </td>

                    <td className={`py-2.5 px-4 ${tw.textSecondary} whitespace-nowrap`}>
                      {row.city || '—'}
                    </td>

                    <td className={`py-2.5 px-4 ${tw.textSecondary} whitespace-nowrap`}>
                      {row.vehicle || '—'}
                    </td>

                    {/* Fleet */}
                    <td className={`py-2.5 px-4 text-right font-medium tabular-nums ${tw.textVal} whitespace-nowrap`}>
                      {row.fleet != null ? Number(row.fleet).toLocaleString('en-IN') : '—'}
                    </td>

                    <td className={`py-2.5 px-4 ${tw.textSecondary} whitespace-nowrap`}>
                      {row.spoc || '—'}
                    </td>

                    {/* Driver Type */}
                    <td className={`py-2.5 px-4 ${tw.textSecondary} whitespace-nowrap`}>
                      {row.driver_type || '—'}
                    </td>

                    {/* Charging Scope */}
                    <td className={`py-2.5 px-4 ${tw.textSecondary} whitespace-nowrap`}>
                      {row.charging_scope || '—'}
                    </td>

                    {/* Quote */}
                    <td className={`py-2.5 px-4 text-right tabular-nums whitespace-nowrap ${tw.textVal}`}>
                      {fmtNum(row.quote)}
                    </td>

                    {/* Total Cost */}
                    <td className={`py-2.5 px-4 text-right tabular-nums whitespace-nowrap ${tw.textVal}`}>
                      {fmtNum(row.total_cost)}
                    </td>

                    {/* Margin */}
                    <td className={`py-2.5 px-4 text-right tabular-nums whitespace-nowrap ${
                      row.margin != null
                        ? row.margin >= 0 ? 'text-emerald-500' : 'text-red-400'
                        : tw.textMuted
                    }`}>
                      {fmtNum(row.margin)}
                    </td>

                    {/* Margin % */}
                    <td className={`py-2.5 px-4 text-right tabular-nums whitespace-nowrap font-medium ${
                      row.margin_percent != null
                        ? row.margin_percent >= 0 ? 'text-emerald-500' : 'text-red-400'
                        : tw.textMuted
                    }`}>
                      {fmtMarginPct(row.margin_percent)}
                    </td>

                    <td className={`py-2.5 px-4 ${tw.textMuted} whitespace-nowrap text-xs`}>
                      {row.date || '—'}
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
