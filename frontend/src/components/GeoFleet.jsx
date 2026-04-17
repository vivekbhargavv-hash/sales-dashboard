import React, { useMemo, useState } from 'react'
import { useTheme } from '../ThemeContext'
import AccordionView from './AccordionView'
import PivotView from './PivotView'

// ── Constants ─────────────────────────────────────────────────────────────────

const REGION_ORDER = ['North', 'West', 'South', 'East', 'Other']

const REGION_COLORS = {
  North: { pill: 'bg-blue-500/15 text-blue-400 border-blue-500/30',   dot: '#3b82f6', bar: 'bg-blue-500' },
  West:  { pill: 'bg-purple-500/15 text-purple-400 border-purple-500/30', dot: '#8b5cf6', bar: 'bg-purple-500' },
  South: { pill: 'bg-green-500/15 text-green-500 border-green-500/30',  dot: '#10b981', bar: 'bg-green-500' },
  East:  { pill: 'bg-orange-500/15 text-orange-400 border-orange-500/30', dot: '#f97316', bar: 'bg-orange-500' },
  Other: { pill: 'bg-slate-500/15 text-slate-400 border-slate-500/30',  dot: '#64748b', bar: 'bg-slate-500' },
}

function fmtNum(v) {
  return Number(v || 0).toLocaleString('en-IN')
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function GeoFleet({ geoFleet, geoFleetNested }) {
  const { tw, isDark } = useTheme()
  const [view, setView] = useState('accordion')

  const rows = geoFleet || []

  const totalFleet = useMemo(
    () => rows.reduce((s, r) => s + (r.fleet || 0), 0),
    [rows]
  )

  const regionSummary = useMemo(() => {
    const map = {}
    for (const r of rows) {
      const reg = r.region || 'Other'
      if (!map[reg]) map[reg] = { fleet: 0, cities: new Set(), clients: new Set() }
      map[reg].fleet += r.fleet || 0
      if (r.city)   map[reg].cities.add(r.city)
      if (r.client) map[reg].clients.add(r.client)
    }
    return REGION_ORDER
      .filter(reg => map[reg])
      .map(reg => ({
        region:  reg,
        fleet:   map[reg].fleet,
        cities:  map[reg].cities.size,
        clients: map[reg].clients.size,
      }))
  }, [rows])

  if (rows.length === 0) {
    return (
      <div className={`${tw.card} rounded-xl p-8 text-center`}>
        <p className={`text-sm ${tw.textSecondary}`}>No geographic fleet data available</p>
      </div>
    )
  }

  const allCities  = regionSummary.reduce((s, r) => s + r.cities,  0)
  const allClients = regionSummary.reduce((s, r) => s + r.clients, 0)

  return (
    <div className="space-y-6">

      {/* ── Region summary cards — horizontal scroll ── */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4" style={{ minWidth: 'max-content' }}>

          {/* All Regions total card */}
          <div
            className={`${tw.card} rounded-xl p-4 border-l-4 w-44 flex-shrink-0`}
            style={{ borderLeftColor: '#22c55e' }}
          >
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border mb-3 bg-green-500/15 text-green-500 border-green-500/30">
              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500" />
              All Regions
            </div>
            <p className={`text-2xl font-bold ${tw.textPrimary}`}>{fmtNum(totalFleet)}</p>
            <p className={`text-xs mt-0.5 ${tw.textMuted}`}>vehicles</p>
            <p className={`text-xs mt-2 ${tw.textSecondary}`}>
              {allCities} cities · {allClients} clients
            </p>
            <div className="mt-3 h-1.5 rounded-full bg-green-500" style={{ width: '100%' }} />
          </div>

          {/* Per-region cards */}
          {regionSummary.map(({ region, fleet, cities, clients }) => {
            const colors = REGION_COLORS[region] || REGION_COLORS.Other
            const pct = totalFleet > 0 ? Math.min(fleet / totalFleet * 100, 100).toFixed(1) : 0
            return (
              <div
                key={region}
                className={`${tw.card} rounded-xl p-4 border-l-4 w-44 flex-shrink-0`}
                style={{ borderLeftColor: colors.dot }}
              >
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border mb-3 ${colors.pill}`}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors.dot }} />
                  {region}
                </div>
                <p className={`text-2xl font-bold ${tw.textPrimary}`}>{fmtNum(fleet)}</p>
                <p className={`text-xs mt-0.5 ${tw.textMuted}`}>vehicles</p>
                <p className={`text-xs mt-2 ${tw.textSecondary}`}>
                  {cities} {cities === 1 ? 'city' : 'cities'} · {clients} clients
                </p>
                <div className={`mt-3 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
                  <div
                    className={`h-1.5 rounded-full ${colors.bar}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Drilldown panel ── */}
      <div className={`${tw.card} rounded-xl overflow-hidden`}>

        {/* Header + view toggle */}
        <div className={`px-5 py-4 flex items-center justify-between border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
          <h2 className={`font-semibold ${tw.textPrimary}`}>
            Region → City → Client → Vehicle Drilldown
          </h2>
          <div className={`flex items-center gap-1 p-1 rounded-lg ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
            <button
              onClick={() => setView('accordion')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === 'accordion'
                  ? isDark
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'bg-white text-gray-900 shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Accordion View
            </button>
            <button
              onClick={() => setView('pivot')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                view === 'pivot'
                  ? isDark
                    ? 'bg-slate-600 text-white shadow-sm'
                    : 'bg-white text-gray-900 shadow-sm'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-200'
                    : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Pivot View
            </button>
          </div>
        </div>

        {/* View content */}
        {view === 'accordion'
          ? <AccordionView geoFleetNested={geoFleetNested} />
          : <PivotView geoFleet={geoFleet} />
        }
      </div>
    </div>
  )
}
