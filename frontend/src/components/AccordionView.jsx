import React, { useState, useCallback } from 'react'
import { ChevronRight, ChevronDown, Globe, MapPin, Building2, Truck } from 'lucide-react'
import { useTheme } from '../ThemeContext'

// ── Constants ──────────────────────────────────────────────────────────────────

const REGION_COLORS = {
  North: { dot: '#3b82f6', pill: 'bg-blue-500/15 text-blue-400 border-blue-500/30'   },
  West:  { dot: '#8b5cf6', pill: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  South: { dot: '#10b981', pill: 'bg-green-500/15 text-green-500 border-green-500/30'  },
  East:  { dot: '#f97316', pill: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  Other: { dot: '#64748b', pill: 'bg-slate-500/15 text-slate-400 border-slate-500/30'  },
}

function fmt(v) {
  return Number(v || 0).toLocaleString('en-IN')
}

// ── Vehicle leaf rows ──────────────────────────────────────────────────────────

function VehicleLeaf({ children: vehicles, tw, isDark }) {
  const alt = isDark ? 'bg-slate-700/10' : 'bg-gray-50/50'
  return (
    <>
      {vehicles.map((v, i) => (
        <tr key={i} className={`border-b ${tw.borderHalf} ${i % 2 === 0 ? alt : ''}`}>
          {/* indent = region(4) + city(8) + client(6) + vehicle(4) = deep */}
          <td className="py-2 px-4" style={{ paddingLeft: '5rem' }}>
            <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${
              v.source === 'Deal'
                ? 'bg-blue-500/10 text-blue-400'
                : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              <Truck className="w-3 h-3 flex-shrink-0" />
              {v.vehicle || '—'}
            </span>
          </td>
          <td className={`py-2 px-4 text-xs ${tw.textSecondary} whitespace-nowrap`}>{v.stage || '—'}</td>
          <td className="py-2 px-4">
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
              v.source === 'Deal'
                ? 'bg-blue-500/10 text-blue-400'
                : 'bg-emerald-500/10 text-emerald-500'
            }`}>
              {v.source || '—'}
            </span>
          </td>
          <td className={`py-2 px-4 text-right text-xs font-semibold tabular-nums ${tw.textVal}`}>
            {fmt(v.fleet)}
          </td>
        </tr>
      ))}
    </>
  )
}

// ── Client rows ────────────────────────────────────────────────────────────────

function ClientRow({ item, tw, isDark, openClients, toggle }) {
  const key  = `cli::${item.client}`
  const open = !!openClients[key]

  return (
    <React.Fragment>
      <tr
        className={`cursor-pointer border-b ${tw.borderHalf} ${tw.rowHover} transition-colors`}
        onClick={() => toggle(key)}
      >
        <td className="py-2.5 px-4" style={{ paddingLeft: '3.5rem' }}>
          <span className="flex items-center gap-2">
            {open
              ? <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 ${tw.textSecondary}`} />
              : <ChevronRight className={`w-3.5 h-3.5 flex-shrink-0 ${tw.textMuted}`} />}
            <Building2 className={`w-3.5 h-3.5 flex-shrink-0 ${tw.textMuted}`} />
            <span className={`text-sm font-medium ${tw.textBody}`}>{item.client}</span>
            <span className={`text-xs ${tw.textMuted}`}>
              ({item.children.length} vehicle line{item.children.length !== 1 ? 's' : ''})
            </span>
          </span>
        </td>
        <td /><td />
        <td className={`py-2.5 px-4 text-right text-sm font-bold tabular-nums ${tw.textVal}`}>
          {fmt(item.fleet)}
        </td>
      </tr>
      {open && (
        <VehicleLeaf children={item.children} tw={tw} isDark={isDark} />
      )}
    </React.Fragment>
  )
}

// ── City rows ─────────────────────────────────────────────────────────────────

function CityRow({ item, tw, isDark, openCities, openClients, toggleCity, toggleClient }) {
  const key  = `city::${item.city}`
  const open = !!openCities[key]

  return (
    <React.Fragment>
      <tr
        className={`cursor-pointer border-b ${tw.borderHalf} ${tw.rowHover} transition-colors`}
        onClick={() => toggleCity(key)}
      >
        <td className="py-2.5 px-4" style={{ paddingLeft: '2rem' }}>
          <span className="flex items-center gap-2">
            {open
              ? <ChevronDown className={`w-4 h-4 flex-shrink-0 ${tw.textSecondary}`} />
              : <ChevronRight className={`w-4 h-4 flex-shrink-0 ${tw.textMuted}`} />}
            <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${tw.textSecondary}`} />
            <span className={`text-sm font-semibold ${tw.textBody}`}>{item.city}</span>
            <span className={`text-xs ${tw.textMuted}`}>
              ({item.children.length} client{item.children.length !== 1 ? 's' : ''})
            </span>
          </span>
        </td>
        <td /><td />
        <td className={`py-2.5 px-4 text-right text-sm font-bold tabular-nums ${tw.textVal}`}>
          {fmt(item.fleet)}
        </td>
      </tr>
      {open && item.children.map(cli => (
        <ClientRow
          key={cli.client}
          item={cli}
          tw={tw}
          isDark={isDark}
          openClients={openClients}
          toggle={toggleClient}
        />
      ))}
    </React.Fragment>
  )
}

// ── Region rows ───────────────────────────────────────────────────────────────

function RegionRow({ item, tw, isDark, openRegions, openCities, openClients,
                     toggleRegion, toggleCity, toggleClient }) {
  const open   = !!openRegions[item.region]
  const colors = REGION_COLORS[item.region] || REGION_COLORS.Other

  return (
    <React.Fragment>
      <tr
        className={`cursor-pointer border-b ${tw.border} ${tw.rowHover} transition-colors`}
        style={{ background: isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.015)' }}
        onClick={() => toggleRegion(item.region)}
      >
        <td className="py-3 px-4">
          <span className="flex items-center gap-2.5">
            {open
              ? <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: colors.dot }} />
              : <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: colors.dot }} />}
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${colors.pill}`}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors.dot }} />
              {item.region}
            </span>
            <span className={`text-xs ${tw.textMuted}`}>
              {item.children.length} {item.children.length === 1 ? 'city' : 'cities'}
            </span>
          </span>
        </td>
        <td /><td />
        <td className={`py-3 px-4 text-right text-base font-bold tabular-nums ${tw.textPrimary}`}>
          {fmt(item.fleet)}
        </td>
      </tr>
      {open && item.children.map(cityItem => (
        <CityRow
          key={cityItem.city}
          item={cityItem}
          tw={tw}
          isDark={isDark}
          openCities={openCities}
          openClients={openClients}
          toggleCity={toggleCity}
          toggleClient={toggleClient}
        />
      ))}
    </React.Fragment>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AccordionView({ geoFleetNested }) {
  const { tw, isDark } = useTheme()
  const [openRegions,  setOpenRegions]  = useState({})
  const [openCities,   setOpenCities]   = useState({})
  const [openClients,  setOpenClients]  = useState({})

  const makeToggle = useCallback(
    setter => key => setter(prev => ({ ...prev, [key]: !prev[key] })),
    []
  )

  const toggleRegion  = makeToggle(setOpenRegions)
  const toggleCity    = makeToggle(setOpenCities)
  const toggleClient  = makeToggle(setOpenClients)

  const nodes = geoFleetNested || []

  if (nodes.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className={`text-sm ${tw.textSecondary}`}>No data for current filters</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className={`sticky top-0 z-10 ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
          <tr className={tw.divider}>
            <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-green-600">
              Region / City / Client / Vehicle
            </th>
            <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-green-600 whitespace-nowrap">
              Stage
            </th>
            <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-green-600">
              Source
            </th>
            <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-green-600 whitespace-nowrap">
              Fleet (Vehicles)
            </th>
          </tr>
        </thead>
        <tbody>
          {nodes.map(regionItem => (
            <RegionRow
              key={regionItem.region}
              item={regionItem}
              tw={tw}
              isDark={isDark}
              openRegions={openRegions}
              openCities={openCities}
              openClients={openClients}
              toggleRegion={toggleRegion}
              toggleCity={toggleCity}
              toggleClient={toggleClient}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
