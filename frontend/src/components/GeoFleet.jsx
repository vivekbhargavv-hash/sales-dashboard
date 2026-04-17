import React, { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, MapPin, Building2, Truck } from 'lucide-react'
import { useTheme, formatFleet } from '../ThemeContext'

// ── Helpers ───────────────────────────────────────────────────────────────────

const REGION_ORDER = ['North', 'West', 'South', 'East', 'Other']

const REGION_COLORS = {
  North: { pill: 'bg-blue-500/15 text-blue-400 border-blue-500/30',   dot: '#3b82f6', bar: 'bg-blue-500' },
  West:  { pill: 'bg-purple-500/15 text-purple-400 border-purple-500/30', dot: '#8b5cf6', bar: 'bg-purple-500' },
  South: { pill: 'bg-green-500/15 text-green-500 border-green-500/30',  dot: '#10b981', bar: 'bg-green-500' },
  East:  { pill: 'bg-orange-500/15 text-orange-400 border-orange-500/30', dot: '#f97316', bar: 'bg-orange-500' },
  Other: { pill: 'bg-slate-500/15 text-slate-400 border-slate-500/30',  dot: '#64748b', bar: 'bg-slate-500' },
}

function fmtFleetNum(v) {
  return Number(v || 0).toLocaleString('en-IN')
}

// Build nested tree: region → city → client → [{vehicle_type, fleet, source, stage}]
function buildTree(rows) {
  const tree = {}
  for (const r of rows) {
    const reg = r.region || 'Other'
    const city = r.city || 'Unknown'
    const client = r.client || 'Unknown'
    if (!tree[reg]) tree[reg] = { fleet: 0, cities: {} }
    tree[reg].fleet += r.fleet || 0
    if (!tree[reg].cities[city]) tree[reg].cities[city] = { fleet: 0, clients: {} }
    tree[reg].cities[city].fleet += r.fleet || 0
    if (!tree[reg].cities[city].clients[client]) tree[reg].cities[city].clients[client] = { fleet: 0, rows: [] }
    tree[reg].cities[city].clients[client].fleet += r.fleet || 0
    tree[reg].cities[city].clients[client].rows.push(r)
  }
  return tree
}

// ── Row components ─────────────────────────────────────────────────────────────

function VehicleRows({ rows, tw, isDark, regionKey }) {
  const altRow = isDark ? 'bg-slate-700/10' : 'bg-gray-50/60'
  return (
    <>
      {rows.map((r, i) => (
        <tr key={i} className={`border-b ${tw.borderHalf} ${i % 2 === 0 ? altRow : ''}`}>
          <td className="py-2 pl-20 pr-4">
            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
              r.source === 'Deal' ? 'bg-blue-500/10 text-blue-400' : 'bg-green-500/10 text-green-500'
            }`}>
              <Truck className="w-3 h-3" />
              {r.vehicle_type || '—'}
            </span>
          </td>
          <td className={`py-2 px-4 text-xs ${tw.textMuted}`}>{r.stage || '—'}</td>
          <td className={`py-2 px-4 text-xs ${tw.textMuted}`}>{r.source || '—'}</td>
          <td className={`py-2 px-4 text-right text-xs font-semibold tabular-nums ${tw.textVal}`}>
            {fmtFleetNum(r.fleet)}
          </td>
        </tr>
      ))}
    </>
  )
}

function ClientRows({ clients, tw, isDark, regionKey, cityKey, openClients, toggleClient }) {
  return (
    <>
      {Object.entries(clients)
        .sort(([, a], [, b]) => b.fleet - a.fleet)
        .map(([client, data]) => {
          const key = `${regionKey}::${cityKey}::${client}`
          const open = !!openClients[key]
          return (
            <React.Fragment key={key}>
              <tr
                className={`cursor-pointer border-b ${tw.borderHalf} ${tw.rowHover} transition-colors`}
                onClick={() => toggleClient(key)}
              >
                <td className="py-2.5 pl-14 pr-4">
                  <span className="flex items-center gap-2">
                    {open
                      ? <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 ${tw.textSecondary}`} />
                      : <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${tw.textMuted}`} />
                    }
                    <Building2 className={`w-3.5 h-3.5 flex-shrink-0 ${tw.textMuted}`} />
                    <span className={`text-sm font-medium ${tw.textBody}`}>{client}</span>
                    <span className={`text-xs ${tw.textMuted}`}>({data.rows.length} line{data.rows.length !== 1 ? 's' : ''})</span>
                  </span>
                </td>
                <td className={`py-2.5 px-4 text-xs ${tw.textMuted}`}></td>
                <td className={`py-2.5 px-4 text-xs ${tw.textMuted}`}></td>
                <td className={`py-2.5 px-4 text-right text-sm font-bold tabular-nums ${tw.textVal}`}>
                  {fmtFleetNum(data.fleet)}
                </td>
              </tr>
              {open && (
                <VehicleRows
                  rows={data.rows}
                  tw={tw}
                  isDark={isDark}
                  regionKey={regionKey}
                />
              )}
            </React.Fragment>
          )
        })}
    </>
  )
}

function CityRows({ cities, tw, isDark, regionKey, openCities, toggleCity, openClients, toggleClient }) {
  return (
    <>
      {Object.entries(cities)
        .sort(([, a], [, b]) => b.fleet - a.fleet)
        .map(([city, data]) => {
          const key = `${regionKey}::${city}`
          const open = !!openCities[key]
          return (
            <React.Fragment key={key}>
              <tr
                className={`cursor-pointer border-b ${tw.borderHalf} ${tw.rowHover} transition-colors`}
                onClick={() => toggleCity(key)}
              >
                <td className="py-2.5 pl-8 pr-4">
                  <span className="flex items-center gap-2">
                    {open
                      ? <ChevronDown className={`w-4 h-4 flex-shrink-0 ${tw.textSecondary}`} />
                      : <ChevronRight className={`w-4 h-4 flex-shrink-0 ${tw.textMuted}`} />
                    }
                    <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${tw.textSecondary}`} />
                    <span className={`text-sm font-semibold ${tw.textBody}`}>{city}</span>
                    <span className={`text-xs ${tw.textMuted}`}>
                      ({Object.keys(data.clients).length} client{Object.keys(data.clients).length !== 1 ? 's' : ''})
                    </span>
                  </span>
                </td>
                <td className={`py-2.5 px-4 text-xs ${tw.textMuted}`}></td>
                <td className={`py-2.5 px-4 text-xs ${tw.textMuted}`}></td>
                <td className={`py-2.5 px-4 text-right text-sm font-bold tabular-nums ${tw.textVal}`}>
                  {fmtFleetNum(data.fleet)}
                </td>
              </tr>
              {open && (
                <ClientRows
                  clients={data.clients}
                  tw={tw}
                  isDark={isDark}
                  regionKey={regionKey}
                  cityKey={city}
                  openClients={openClients}
                  toggleClient={toggleClient}
                />
              )}
            </React.Fragment>
          )
        })}
    </>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function GeoFleet({ geoFleet }) {
  const { tw, isDark } = useTheme()
  const [openRegions,  setOpenRegions]  = useState({})
  const [openCities,   setOpenCities]   = useState({})
  const [openClients,  setOpenClients]  = useState({})

  const toggle = (setter) => (key) => setter(prev => ({ ...prev, [key]: !prev[key] }))

  const tree = useMemo(() => buildTree(geoFleet || []), [geoFleet])

  const totalFleet = useMemo(
    () => (geoFleet || []).reduce((s, r) => s + (r.fleet || 0), 0),
    [geoFleet]
  )

  // Summary cards per region
  const regionSummary = useMemo(() =>
    REGION_ORDER
      .filter(r => tree[r])
      .map(r => ({
        region: r,
        fleet: tree[r].fleet,
        cities: Object.keys(tree[r].cities).length,
        clients: Object.values(tree[r].cities).reduce((s, c) => s + Object.keys(c.clients).length, 0),
      })),
    [tree]
  )

  if (!geoFleet || geoFleet.length === 0) {
    return (
      <div className={`${tw.card} rounded-xl p-8 text-center`}>
        <p className={`text-sm ${tw.textSecondary}`}>No geographic fleet data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* ── Region summary cards — 5 columns, horizontal scroll on small screens ── */}
      <div className="overflow-x-auto pb-1">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(160px, 1fr))', gap: '1rem' }}>
          {/* Total card */}
          <div className={`${tw.card} rounded-xl p-4 border-l-4`}
            style={{ borderLeftColor: '#22c55e' }}>
            <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border mb-3 bg-green-500/15 text-green-500 border-green-500/30`}>
              <span className="w-2 h-2 rounded-full flex-shrink-0 bg-green-500" />
              All Regions
            </div>
            <p className={`text-2xl font-bold ${tw.textPrimary}`}>{fmtFleetNum(totalFleet)}</p>
            <p className={`text-xs mt-0.5 ${tw.textMuted}`}>vehicles</p>
            <p className={`text-xs mt-2 ${tw.textSecondary}`}>
              {regionSummary.reduce((s, r) => s + r.cities, 0)} cities ·{' '}
              {regionSummary.reduce((s, r) => s + r.clients, 0)} clients
            </p>
            <div className={`mt-3 h-1.5 rounded-full bg-green-500`} style={{ width: '100%' }} />
          </div>

          {regionSummary.map(({ region, fleet, cities, clients }) => {
            const colors = REGION_COLORS[region] || REGION_COLORS.Other
            return (
              <div key={region} className={`${tw.card} rounded-xl p-4 border-l-4`}
                style={{ borderLeftColor: colors.dot }}>
                <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border mb-3 ${colors.pill}`}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors.dot }} />
                  {region}
                </div>
                <p className={`text-2xl font-bold ${tw.textPrimary}`}>{fmtFleetNum(fleet)}</p>
                <p className={`text-xs mt-0.5 ${tw.textMuted}`}>vehicles</p>
                <p className={`text-xs mt-2 ${tw.textSecondary}`}>
                  {cities} {cities === 1 ? 'city' : 'cities'} · {clients} clients
                </p>
                {totalFleet > 0 && (
                  <div className={`mt-3 h-1.5 rounded-full ${isDark ? 'bg-slate-700' : 'bg-gray-100'}`}>
                    <div
                      className={`h-1.5 rounded-full ${colors.bar}`}
                      style={{ width: `${Math.min(fleet / totalFleet * 100, 100).toFixed(1)}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Drilldown table ── */}
      <div className={`${tw.card} rounded-xl overflow-hidden`}>
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: 'inherit' }}>
          <h2 className={`font-semibold ${tw.textPrimary}`}>Region → City → Client → Vehicle Drilldown</h2>
          <span className={`text-xs ${tw.textMuted}`}>Click rows to expand</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={`${isDark ? 'bg-slate-800' : 'bg-white'} sticky top-0 z-10`}>
              <tr className={tw.divider}>
                <th className={`py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-green-600`}>
                  Region / City / Client / Vehicle
                </th>
                <th className={`py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-green-600`}>
                  Stage
                </th>
                <th className={`py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-green-600`}>
                  Source
                </th>
                <th className={`py-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-green-600 whitespace-nowrap`}>
                  Fleet (Vehicles)
                </th>
              </tr>
            </thead>
            <tbody>
              {REGION_ORDER.filter(r => tree[r]).map(regionKey => {
                const rData = tree[regionKey]
                const rOpen = !!openRegions[regionKey]
                const colors = REGION_COLORS[regionKey] || REGION_COLORS.Other

                return (
                  <React.Fragment key={regionKey}>
                    {/* Region row */}
                    <tr
                      className={`cursor-pointer border-b ${tw.border} ${tw.rowHover} transition-colors`}
                      style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                      onClick={() => toggle(setOpenRegions)(regionKey)}
                    >
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-2.5">
                          {rOpen
                            ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: colors.dot }} />
                            : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: colors.dot }} />
                          }
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${colors.pill}`}>
                            <span className="w-2 h-2 rounded-full" style={{ background: colors.dot }} />
                            {regionKey}
                          </span>
                          <span className={`text-xs ${tw.textMuted}`}>
                            {Object.keys(rData.cities).length} {Object.keys(rData.cities).length === 1 ? 'city' : 'cities'}
                          </span>
                        </span>
                      </td>
                      <td />
                      <td />
                      <td className={`py-3 px-4 text-right text-base font-bold tabular-nums ${tw.textPrimary}`}>
                        {fmtFleetNum(rData.fleet)}
                      </td>
                    </tr>

                    {/* Cities */}
                    {rOpen && (
                      <CityRows
                        cities={rData.cities}
                        tw={tw}
                        isDark={isDark}
                        regionKey={regionKey}
                        openCities={openCities}
                        toggleCity={toggle(setOpenCities)}
                        openClients={openClients}
                        toggleClient={toggle(setOpenClients)}
                      />
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
