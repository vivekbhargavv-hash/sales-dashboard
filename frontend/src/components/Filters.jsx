import React, { useState, useRef, useEffect } from 'react'
import { Filter, X, ChevronDown } from 'lucide-react'
import { useTheme, STAGE_ORDER } from '../ThemeContext'

function MultiSelect({ label, options, selected, onChange, tw }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (val) => {
    if (selected.includes(val)) onChange(selected.filter(v => v !== val))
    else onChange([...selected, val])
  }

  const isActive = selected.length > 0

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
          isActive ? tw.filterBtnActive : tw.filterBtn
        }`}
      >
        <span>{label}</span>
        {isActive && (
          <span className={`${tw.filterBadge} text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold`}>
            {selected.length}
          </span>
        )}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute top-full left-0 mt-1 z-50 ${tw.filterDropdown} rounded-xl shadow-2xl min-w-[190px] max-h-56 overflow-y-auto`}>
          {options.length === 0 ? (
            <div className={`px-4 py-3 text-sm ${tw.textSecondary}`}>No options</div>
          ) : (
            options.map(opt => (
              <label
                key={opt}
                className={`flex items-center gap-3 px-4 py-2 ${tw.filterOption} cursor-pointer transition-colors`}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="w-4 h-4 rounded accent-green-500"
                />
                <span className={`text-sm ${tw.filterOptionText} truncate`}>{opt || '(blank)'}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function Filters({ data, filters, onFiltersChange }) {
  const { tw } = useTheme()
  const summaryTable   = data?.summary_table   || []
  const combinedRecords = data?.combined_records || []
  const geoFleet       = data?.geo_fleet        || []

  const getUnique = (field) => [...new Set(summaryTable.map(r => r[field]).filter(Boolean))].sort()

  // Stages: deal stages from summary_table PLUS project stages from combined_records + geo_fleet
  const dealStages    = summaryTable.map(r => r.stage)
  const projectStages = [
    ...combinedRecords.map(r => r.stage),
    ...geoFleet.map(r => r.stage),
  ]
  const allStagesSet = new Set([...dealStages, ...projectStages].filter(Boolean))
  const stages = [
    ...STAGE_ORDER.filter(s => allStagesSet.has(s)),
    ...[...allStagesSet].filter(s => !STAGE_ORDER.includes(s)).sort(),
  ]

  // Cities and vehicle categories from both deals and geo_fleet
  const citiesSet = new Set([
    ...summaryTable.map(r => r.city),
    ...geoFleet.map(r => r.city),
  ].filter(Boolean))
  const cities = [...citiesSet].sort()

  const categoriesSet = new Set([
    ...summaryTable.map(r => r.vehicle_category),
    ...geoFleet.map(r => r.vehicle_category),
  ].filter(Boolean))
  const categories = [...categoriesSet].sort()

  // SPOCs from deals + geo_fleet (which carries project assigned_to)
  const assigneesSet = new Set([
    ...summaryTable.map(r => r.assigned_to),
    ...geoFleet.map(r => r.assigned_to),
  ].filter(Boolean))
  const assignees = [...assigneesSet].sort()

  const activeCount = Object.values(filters).reduce((sum, arr) => sum + arr.length, 0)

  const clearAll = () => onFiltersChange({ cities: [], stages: [], categories: [], assignees: [] })

  return (
    <div className={`flex items-center gap-3 px-6 py-2.5 ${tw.filter} flex-wrap`}>
      <div className={`flex items-center gap-1.5 text-sm ${tw.textSecondary}`}>
        <Filter className="w-3.5 h-3.5" />
        <span className="font-medium">Filters:</span>
      </div>

      <MultiSelect
        label="City"
        options={cities}
        selected={filters.cities}
        onChange={(v) => onFiltersChange({ ...filters, cities: v })}
        tw={tw}
      />
      <MultiSelect
        label="Stage"
        options={stages}
        selected={filters.stages}
        onChange={(v) => onFiltersChange({ ...filters, stages: v })}
        tw={tw}
      />
      <MultiSelect
        label="Vehicle Category"
        options={categories}
        selected={filters.categories}
        onChange={(v) => onFiltersChange({ ...filters, categories: v })}
        tw={tw}
      />
      <MultiSelect
        label="Assigned To"
        options={assignees}
        selected={filters.assignees}
        onChange={(v) => onFiltersChange({ ...filters, assignees: v })}
        tw={tw}
      />

      {activeCount > 0 && (
        <>
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-red-500 border border-red-500/30 hover:bg-red-500/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Clear ({activeCount})
          </button>
          <span className={`ml-auto text-xs ${tw.textMuted}`}>
            {activeCount} filter{activeCount > 1 ? 's' : ''} active
          </span>
        </>
      )}
    </div>
  )
}
