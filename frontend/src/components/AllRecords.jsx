import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useTheme } from '../ThemeContext'
import { ChevronDown, X } from 'lucide-react'

// ── Multi-select dropdown component ──────────────────────────────────────────

function MultiSelectDropdown({ label, options, selected, onChange, tw, isDark }) {
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

  const selectedCount = selected.size
  const isActive = selectedCount > 0

  function toggleOption(val) {
    const next = new Set(selected)
    if (next.has(val)) next.delete(val)
    else next.add(val)
    onChange(next)
  }

  function clearAll() {
    onChange(new Set())
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors
          ${isActive ? tw.filterBtnActive : tw.filterBtn}`}
      >
        <span>{label}</span>
        {isActive && (
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${tw.filterBadge}`}>
            {selectedCount}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''} ${
            isActive ? '' : tw.textMuted
          }`}
        />
      </button>

      {open && (
        <div
          className={`absolute z-50 top-full mt-1.5 left-0 min-w-[180px] max-h-64 overflow-y-auto
            rounded-xl shadow-2xl ${tw.filterDropdown}`}
        >
          <div className={`flex items-center justify-between px-3 py-2 border-b ${tw.borderHalf}`}>
            <span className={`text-xs font-semibold uppercase tracking-wide ${tw.textSecondary}`}>
              {label}
            </span>
            {isActive && (
              <button
                onClick={clearAll}
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
          <div className="py-1">
            {options.map(opt => (
              <label
                key={opt}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer ${tw.filterOption} transition-colors`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(opt)}
                  onChange={() => toggleOption(opt)}
                  className="w-3.5 h-3.5 accent-green-500 cursor-pointer flex-shrink-0"
                />
                <span className={`text-sm truncate ${tw.filterOptionText}`}>{opt}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AllRecords({ combinedRecords }) {
  const { tw, isDark } = useTheme()

  const [selectedTypes, setSelectedTypes]   = useState(new Set())
  const [selectedStages, setSelectedStages] = useState(new Set())
  const [selectedCities, setSelectedCities] = useState(new Set())
  const [selectedSpocs, setSelectedSpocs]   = useState(new Set())

  // Derive unique filter options from the full dataset
  const { typeOptions, stageOptions, cityOptions, spocOptions } = useMemo(() => {
    if (!combinedRecords || combinedRecords.length === 0) {
      return { typeOptions: [], stageOptions: [], cityOptions: [], spocOptions: [] }
    }
    const unique = (key) => [
      ...new Set(combinedRecords.map(r => r[key]).filter(Boolean))
    ].sort()
    return {
      typeOptions:  [...new Set(combinedRecords.map(r => r.type).filter(Boolean))].sort(),
      stageOptions: unique('stage'),
      cityOptions:  unique('city'),
      spocOptions:  unique('spoc'),
    }
  }, [combinedRecords])

  // Apply filters
  const filteredRecords = useMemo(() => {
    if (!combinedRecords) return []
    return combinedRecords.filter(r => {
      if (selectedTypes.size  > 0 && !selectedTypes.has(r.type))   return false
      if (selectedStages.size > 0 && !selectedStages.has(r.stage)) return false
      if (selectedCities.size > 0 && !selectedCities.has(r.city))  return false
      if (selectedSpocs.size  > 0 && !selectedSpocs.has(r.spoc))   return false
      return true
    })
  }, [combinedRecords, selectedTypes, selectedStages, selectedCities, selectedSpocs])

  const total   = combinedRecords?.length ?? 0
  const showing = filteredRecords.length

  const altRow = isDark ? 'bg-slate-700/20' : 'bg-gray-50'

  if (!combinedRecords || combinedRecords.length === 0) {
    return (
      <div className={`${tw.card} rounded-xl p-8 text-center`}>
        <p className={`text-sm ${tw.textSecondary}`}>No records available</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <MultiSelectDropdown
          label="Type"
          options={typeOptions}
          selected={selectedTypes}
          onChange={setSelectedTypes}
          tw={tw}
          isDark={isDark}
        />
        <MultiSelectDropdown
          label="Stage"
          options={stageOptions}
          selected={selectedStages}
          onChange={setSelectedStages}
          tw={tw}
          isDark={isDark}
        />
        <MultiSelectDropdown
          label="City"
          options={cityOptions}
          selected={selectedCities}
          onChange={setSelectedCities}
          tw={tw}
          isDark={isDark}
        />
        <MultiSelectDropdown
          label="SPOC"
          options={spocOptions}
          selected={selectedSpocs}
          onChange={setSelectedSpocs}
          tw={tw}
          isDark={isDark}
        />

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
                  {[
                    { label: 'Type',         align: 'left'  },
                    { label: 'Name',         align: 'left'  },
                    { label: 'Client',       align: 'left'  },
                    { label: 'Stage',        align: 'left'  },
                    { label: 'City',         align: 'left'  },
                    { label: 'Vehicle',      align: 'left'  },
                    { label: 'Fleet',        align: 'right' },
                    { label: 'SPOC',         align: 'left'  },
                    { label: 'Last Updated', align: 'left'  },
                  ].map(col => (
                    <th
                      key={col.label}
                      className={`py-3 px-4 text-xs font-semibold uppercase tracking-wide text-green-600
                        whitespace-nowrap text-${col.align}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((row, i) => (
                  <tr
                    key={i}
                    className={`${tw.rowHover} transition-colors duration-100 ${
                      i % 2 === 0 ? altRow : ''
                    } border-b ${tw.borderHalf}`}
                  >
                    {/* Type badge */}
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          row.type === 'Deal'
                            ? 'bg-blue-500/15 text-blue-400'
                            : 'bg-green-500/15 text-green-500'
                        }`}
                      >
                        {row.type || '—'}
                      </span>
                    </td>

                    <td className={`py-2.5 px-4 font-medium ${tw.textBody} max-w-[200px] truncate`}>
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

                    {/* Fleet — right-aligned, en-IN formatted */}
                    <td className={`py-2.5 px-4 text-right font-medium tabular-nums ${tw.textVal} whitespace-nowrap`}>
                      {row.fleet != null && row.fleet !== ''
                        ? Number(row.fleet).toLocaleString('en-IN')
                        : '—'}
                    </td>

                    <td className={`py-2.5 px-4 ${tw.textSecondary} whitespace-nowrap`}>
                      {row.spoc || '—'}
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
