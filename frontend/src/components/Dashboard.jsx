import React, { useState, useMemo } from 'react'
import { UploadCloud, Sun, Moon, LogOut, User, Clock } from 'lucide-react'
import { useTheme, STAGE_ORDER, sortByStageOrder } from '../ThemeContext'
import Filters from './Filters'
import KPICards from './KPICards'
import StageSummary from './StageSummary'
import VehicleCategory from './VehicleCategory'
import PipelineForecast from './PipelineForecast'
import SalesFunnel from './SalesFunnel'
import MoMPerformance from './MoMPerformance'
import TopClients from './TopClients'
import ConcentrationRisk from './ConcentrationRisk'
import DrilldownPivot from './DrilldownPivot'
import CityHeatmap from './CityHeatmap'

const TABS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'pipeline',    label: 'Pipeline Health' },
  { id: 'conversion',  label: 'Conversion & Velocity' },
  { id: 'clients',     label: 'Client Insights' },
  { id: 'geo',         label: 'Geographic & Fleet' },
]

function applyFilters(data, filters) {
  if (!data) return data
  const { cities, stages, categories, assignees } = filters
  const hasFilters = cities.length || stages.length || categories.length || assignees.length
  if (!hasFilters) return data

  const table = (data.summary_table || []).filter(row => {
    if (cities.length     && !cities.includes(row.city))             return false
    if (stages.length     && !stages.includes(row.stage))            return false
    if (categories.length && !categories.includes(row.vehicle_category)) return false
    if (assignees.length  && !assignees.includes(row.assigned_to))   return false
    return true
  })

  const notLost    = table.filter(r => r.stage !== 'Closed Lost')
  const closedWon  = table.filter(r => r.stage === 'Closed Won')
  const pendingDepl = table.filter(r => r.stage === 'Pending Deployment')

  const sum = (arr, field) => arr.reduce((s, r) => s + (parseFloat(r[field]) || 0), 0)
  const totalPipeline = sum(notLost, 'deal_size')
  const totalCW       = sum(closedWon, 'deal_size')
  const totalPD       = sum(pendingDepl, 'deal_size')
  const totalOpps     = table.length
  const posDeals      = table.filter(r => parseFloat(r.deal_size) > 0)
  const avgDeal       = posDeals.length ? sum(posDeals, 'deal_size') / posDeals.length : 0
  const winRate       = totalOpps > 0 ? (closedWon.length / totalOpps) * 100 : 0

  const stageMap = {}
  table.forEach(r => {
    if (!stageMap[r.stage]) stageMap[r.stage] = { count: 0, total_deal_size: 0 }
    stageMap[r.stage].count++
    stageMap[r.stage].total_deal_size += parseFloat(r.deal_size) || 0
  })
  const stageSummary = sortByStageOrder(Object.entries(stageMap).map(([stage, v]) => ({ stage, ...v })))

  const vcMap = {}
  table.forEach(r => {
    const vc = r.vehicle_category || 'Others'
    if (!vcMap[vc]) vcMap[vc] = { total_deal_size: 0, count: 0 }
    vcMap[vc].total_deal_size += parseFloat(r.deal_size) || 0
    vcMap[vc].count++
  })
  const totalDS = sum(table, 'deal_size')
  const vehicleCategory = Object.entries(vcMap)
    .map(([k, v]) => ({ vehicle_category: k, ...v, pct: totalDS > 0 ? v.total_deal_size / totalDS * 100 : 0 }))
    .sort((a, b) => b.total_deal_size - a.total_deal_size)

  const clientMap = {}
  notLost.forEach(r => {
    if (!clientMap[r.client_name]) clientMap[r.client_name] = { total_deal_size: 0, count: 0 }
    clientMap[r.client_name].total_deal_size += parseFloat(r.deal_size) || 0
    clientMap[r.client_name].count++
  })
  const topClients = Object.entries(clientMap)
    .map(([name, v]) => ({ client_name: name, ...v, avg_deal_size: v.count ? v.total_deal_size / v.count : 0 }))
    .sort((a, b) => b.total_deal_size - a.total_deal_size)
    .slice(0, 10)

  const cityMap = {}
  table.filter(r => ['Closed Won', 'Pending Deployment'].includes(r.stage)).forEach(r => {
    if (!cityMap[r.city]) cityMap[r.city] = { total_deal_size: 0, count: 0 }
    cityMap[r.city].total_deal_size += parseFloat(r.deal_size) || 0
    cityMap[r.city].count++
  })
  const cityHeatmap = Object.entries(cityMap)
    .map(([city, v]) => ({ city, ...v }))
    .sort((a, b) => b.total_deal_size - a.total_deal_size)

  const nlTotal  = sum(notLost, 'deal_size')
  const top5     = topClients.slice(0, 5)
  const top10    = topClients.slice(0, 10)
  const top5val  = top5.reduce((s, c)  => s + c.total_deal_size, 0)
  const top10val = top10.reduce((s, c) => s + c.total_deal_size, 0)

  return {
    ...data,
    summary_table: table,
    kpis: { ...data.kpis, total_pipeline_value: totalPipeline, total_closed_won: totalCW,
      total_pending_deployment: totalPD, total_opportunities: totalOpps, avg_deal_size: avgDeal, win_rate: winRate },
    stage_summary: stageSummary,
    vehicle_category: vehicleCategory,
    top_clients: topClients,
    city_heatmap: cityHeatmap,
    concentration_risk: {
      top5_pct:     nlTotal > 0 ? top5val  / nlTotal * 100 : 0,
      top10_pct:    nlTotal > 0 ? top10val / nlTotal * 100 : 0,
      top5_clients:  top5.map(c  => ({ client_name: c.client_name, value: c.total_deal_size, pct: nlTotal > 0 ? c.total_deal_size / nlTotal * 100 : 0 })),
      top10_clients: top10.map(c => ({ client_name: c.client_name, value: c.total_deal_size, pct: nlTotal > 0 ? c.total_deal_size / nlTotal * 100 : 0 })),
    }
  }
}

function formatUploadedAt(iso) {
  if (!iso) return null
  try {
    const d = new Date(iso)
    return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
  } catch { return null }
}

export default function Dashboard({ data, onReset, user, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [filters, setFilters]     = useState({ cities: [], stages: [], categories: [], assignees: [] })
  const { isDark, toggleTheme, tw } = useTheme()

  const filteredData = useMemo(() => applyFilters(data, filters), [data, filters])
  const uploadedAt   = formatUploadedAt(data?.uploaded_at)

  const renderTab = () => {
    const d = filteredData
    switch (activeTab) {
      case 'overview':   return <div className="space-y-6"><KPICards kpis={d.kpis} /><div className="grid grid-cols-1 xl:grid-cols-2 gap-6"><StageSummary stageSummary={d.stage_summary} /><VehicleCategory vehicleCategory={d.vehicle_category} /></div></div>
      case 'pipeline':   return <div className="space-y-6"><PipelineForecast forecast={d.forecast} /><StageSummary stageSummary={d.stage_summary} /></div>
      case 'conversion': return <div className="space-y-6"><SalesFunnel funnel={d.funnel} /><MoMPerformance momPerformance={d.mom_performance} velocity={d.velocity} /></div>
      case 'clients':    return <div className="space-y-6"><TopClients topClients={d.top_clients} /><div className="grid grid-cols-1 xl:grid-cols-2 gap-6"><ConcentrationRisk concentrationRisk={d.concentration_risk} /><DrilldownPivot drilldown={d.drilldown} /></div></div>
      case 'geo':        return <div className="space-y-6"><CityHeatmap cityHeatmap={d.city_heatmap} /><VehicleCategory vehicleCategory={d.vehicle_category} /></div>
      default:           return null
    }
  }

  return (
    <div className={`min-h-screen flex flex-col ${tw.root}`}>

      {/* Header */}
      <header className={`${tw.header} px-6 py-3 flex items-center justify-between flex-shrink-0`}>
        <div className="flex items-center gap-3">
          <picture>
            <source srcSet="/moeving-logo.png" type="image/png" />
            <img src="/moeving-logo.svg" alt="Moeving" className="h-9 w-auto object-contain"
              onError={e => { e.target.style.display = 'none' }} />
          </picture>
          <div>
            <h1 className={`font-bold text-sm leading-tight ${tw.textPrimary}`}>Moeving Sales Intelligence</h1>
            <div className={`flex items-center gap-3 text-xs ${tw.textSecondary}`}>
              <span>{data?.summary_table?.length || 0} records</span>
              {uploadedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />Updated {uploadedAt}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* User badge */}
          {user && (
            <span className={`hidden lg:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
              <User className="w-3 h-3" />{user.name}
            </span>
          )}

          {/* Theme toggle */}
          <button onClick={toggleTheme}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
              isDark ? 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600' : 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
            <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
          </button>

          {/* Upload new */}
          <button onClick={onReset}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${tw.uploadReset}`}>
            <UploadCloud className="w-4 h-4" />
            <span className="hidden sm:inline">New Upload</span>
          </button>

          {/* Logout */}
          <button onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm text-red-500 border-red-500/30 hover:bg-red-500/10 transition-colors">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Nav Tabs */}
      <nav className={`${tw.nav} px-6 flex gap-1 flex-shrink-0`}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.id ? tw.tabActive : tw.tabInactive
            }`}>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Filters */}
      <Filters data={data} filters={filters} onFiltersChange={setFilters} />

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        {renderTab()}
      </main>
    </div>
  )
}
