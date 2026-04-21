import React, { useState, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { UploadCloud, Sun, Moon, LogOut, User, Clock, Truck, TrendingUp } from 'lucide-react'
import { useTheme, STAGE_ORDER, STAGE_COLORS, sortByStageOrder, formatFleet, formatNum } from '../ThemeContext'
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
import GeoFleet from './GeoFleet'
import MonthlyClosures from './MonthlyClosures'
import AllRecords from './AllRecords'
import TargetsVsActuals from './TargetsVsActuals'

const TABS = [
  { id: 'overview',         label: 'Overview' },
  { id: 'pipeline',         label: 'Pipeline Health' },
  { id: 'clients',          label: 'Client Insights' },
  { id: 'geo',              label: 'Geographic & Fleet' },
  { id: 'monthly_closures', label: 'Monthly Closures' },
  { id: 'targets',          label: 'Targets vs Actuals' },
  { id: 'all_records',      label: 'All Records' },
]

// Deployment stage colours (pill badges + bar chart)
const DEPL_COLORS = {
  'Pending Deployment': { bg: 'bg-yellow-500/15', text: 'text-yellow-500', border: 'border-yellow-500/30', bar: '#eab308' },
  'Partially Deployed': { bg: 'bg-blue-500/15',   text: 'text-blue-400',   border: 'border-blue-500/30',   bar: '#3b82f6' },
  'Deployed':           { bg: 'bg-green-500/15',  text: 'text-green-500',  border: 'border-green-500/30',  bar: '#10b981' },
  'On Hold':            { bg: 'bg-orange-500/15', text: 'text-orange-400', border: 'border-orange-500/30', bar: '#f97316' },
  'Lost':               { bg: 'bg-red-500/15',    text: 'text-red-400',    border: 'border-red-500/30',    bar: '#ef4444' },
}

function DeploymentPipelineSection({ deploymentSummary, deploymentEfficiency }) {
  const { isDark, tw, ct } = useTheme()
  if (!deploymentSummary || deploymentSummary.length === 0) return null

  const chartOption = {
    backgroundColor: ct.bg,
    tooltip: {
      trigger: 'axis',
      backgroundColor: ct.tooltip.backgroundColor,
      borderColor: ct.tooltip.borderColor,
      textStyle: ct.tooltip.textStyle,
      extraCssText: ct.tooltip.extraCssText,
      formatter: (params) => {
        const p = params[0]
        const item = deploymentSummary.find(d => d.stage === p.name)
        return `<b>${p.name}</b><br/>Fleet: <b>${formatFleet(p.value)}</b> vehicles<br/>Count: <b>${item?.count ?? 0}</b> projects`
      }
    },
    grid: { left: '2%', right: '10%', top: '5%', bottom: '5%', containLabel: true },
    xAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: ct.axisLine } },
      splitLine: { lineStyle: { color: ct.splitLine } },
      axisLabel: { color: ct.text, fontSize: 10, formatter: (v) => formatFleet(v) },
    },
    yAxis: {
      type: 'category',
      data: deploymentSummary.map(d => d.stage),
      axisLine: { lineStyle: { color: ct.axisLine } },
      axisLabel: { color: ct.text, fontSize: 11 },
    },
    series: [{
      type: 'bar',
      data: deploymentSummary.map(d => ({
        value: d.fleet,
        itemStyle: {
          color: DEPL_COLORS[d.stage]?.bar || '#64748b',
          borderRadius: [0, 4, 4, 0],
        }
      })),
      label: {
        show: true,
        position: 'right',
        color: ct.text,
        fontSize: 10,
        formatter: (p) => formatFleet(p.value),
      }
    }]
  }

  return (
    <div className={`${tw.card} rounded-2xl p-5`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-green-500" />
          <h2 className={`font-semibold text-base ${tw.textPrimary}`}>Deployment Pipeline</h2>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border ${
          isDark ? 'border-green-500/30 bg-green-500/10' : 'border-green-300 bg-green-50'
        }`}>
          <TrendingUp className="w-4 h-4 text-green-500" />
          <span className={`text-xs font-medium ${tw.textSecondary}`}>Deployment Efficiency</span>
          <span className="text-green-500 font-bold text-sm">{deploymentEfficiency ?? 0}%</span>
        </div>
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        {deploymentSummary.map(item => {
          const colors = DEPL_COLORS[item.stage] || { bg: 'bg-slate-500/15', text: 'text-slate-400', border: 'border-slate-500/30' }
          return (
            <div key={item.stage}
              className={`rounded-xl border p-3 flex flex-col gap-1 ${colors.bg} ${colors.border}`}>
              <span className={`text-xs font-semibold truncate ${colors.text}`}>{item.stage}</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-xl font-bold ${tw.textPrimary}`}>{item.count}</span>
                <span className={`text-xs ${tw.textMuted}`}>opps</span>
              </div>
              <span className={`text-xs ${tw.textSecondary}`}>
                {formatFleet(item.fleet)} vehicles
              </span>
            </div>
          )
        })}
      </div>

      {/* Bar chart */}
      <ReactECharts option={chartOption} style={{ height: '200px', width: '100%' }} />
    </div>
  )
}

// ── Rebuild geo_fleet_nested from filtered flat rows (mirrors backend logic) ──
const GEO_REGION_ORDER = ['North', 'West', 'South', 'East', 'Other']

function buildGeoNested(rows) {
  const regions = {}
  for (const r of (rows || [])) {
    const reg    = r.region || 'Other'
    const city   = r.city   || 'Unknown'
    const client = r.client || 'Unknown'
    if (!regions[reg]) regions[reg] = { region: reg, fleet: 0, cities: {} }
    regions[reg].fleet += r.fleet || 0
    if (!regions[reg].cities[city]) regions[reg].cities[city] = { city, fleet: 0, clients: {} }
    regions[reg].cities[city].fleet += r.fleet || 0
    const clients = regions[reg].cities[city].clients
    if (!clients[client]) clients[client] = { client, fleet: 0, vehicles: [] }
    clients[client].fleet += r.fleet || 0
    clients[client].vehicles.push({
      vehicle: r.vehicle_type, fleet: r.fleet || 0, stage: r.stage, source: r.source,
    })
  }
  return GEO_REGION_ORDER
    .filter(reg => regions[reg])
    .map(reg => ({
      region: reg,
      fleet:  regions[reg].fleet,
      children: Object.values(regions[reg].cities)
        .sort((a, b) => b.fleet - a.fleet)
        .map(c => ({
          city: c.city, fleet: c.fleet,
          children: Object.values(c.clients)
            .sort((a, b) => b.fleet - a.fleet)
            .map(cl => ({
              client: cl.client, fleet: cl.fleet,
              children: cl.vehicles.sort((a, b) => b.fleet - a.fleet),
            })),
        })),
    }))
}

function applyFilters(data, filters) {
  if (!data) return data
  const { cities, stages, categories, assignees } = filters
  const hasFilters = cities.length || stages.length || categories.length || assignees.length
  if (!hasFilters) return data

  // Filter geo_fleet rows using the same criteria
  const geoFleet = (data.geo_fleet || []).filter(row => {
    if (cities.length     && !cities.includes(row.city))             return false
    if (stages.length     && !stages.includes(row.stage))            return false
    if (categories.length && !categories.includes(row.vehicle_category)) return false
    if (assignees.length  && !assignees.includes(row.assigned_to))   return false
    return true
  })

  const table = (data.summary_table || []).filter(row => {
    if (cities.length     && !cities.includes(row.city))                 return false
    if (stages.length     && !stages.includes(row.stage))                return false
    if (categories.length && !categories.includes(row.vehicle_category)) return false
    if (assignees.length  && !assignees.includes(row.assigned_to))       return false
    return true
  })

  const notLost     = table.filter(r => r.stage !== 'Closed Lost')
  const closedWon   = table.filter(r => r.stage === 'Closed Won')
  const sum = (arr, field) => arr.reduce((s, r) => s + (parseFloat(r[field]) || 0), 0)
  const totalPipeline = sum(notLost, 'deal_size')
  const totalCW       = sum(closedWon, 'deal_size')
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
  const stageSummary = sortByStageOrder(
    Object.entries(stageMap).map(([stage, v]) => ({ stage, ...v }))
  )

  const vcMap = {}
  table.forEach(r => {
    const vc = r.vehicle_category || 'Others'
    if (!vcMap[vc]) vcMap[vc] = { total_deal_size: 0, count: 0 }
    vcMap[vc].total_deal_size += parseFloat(r.deal_size) || 0
    vcMap[vc].count++
  })
  const totalDS = sum(table, 'deal_size')
  const vehicleCategory = Object.entries(vcMap)
    .map(([k, v]) => ({
      vehicle_category: k, ...v,
      pct: totalDS > 0 ? v.total_deal_size / totalDS * 100 : 0
    }))
    .sort((a, b) => b.total_deal_size - a.total_deal_size)

  const clientMap = {}
  notLost.forEach(r => {
    const key = r.org_name?.trim() || r.client_name || 'Unknown'
    if (!clientMap[key]) clientMap[key] = { total_deal_size: 0, count: 0 }
    clientMap[key].total_deal_size += parseFloat(r.deal_size) || 0
    clientMap[key].count++
  })
  const topClients = Object.entries(clientMap)
    .map(([name, v]) => ({
      client_name: name, ...v,
      avg_deal_size: v.count ? v.total_deal_size / v.count : 0
    }))
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
    kpis: {
      ...data.kpis,
      total_pipeline_value:    totalPipeline,
      total_closed_won:        totalCW,
      total_opportunities:     totalOpps,
      avg_deal_size:           avgDeal,
      win_rate:                winRate,
    },
    stage_summary:    stageSummary,
    vehicle_category: vehicleCategory,
    top_clients:      topClients,
    city_heatmap:     cityHeatmap,
    geo_fleet:        geoFleet,
    geo_fleet_nested: buildGeoNested(geoFleet),
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

  // Tabs that should NOT show the filter bar
  const noFilterTabs = new Set(['monthly_closures', 'all_records', 'targets'])

  const renderTab = () => {
    const d = filteredData
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            <KPICards kpis={d.kpis} />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <StageSummary stageSummary={d.stage_summary} title="Deals Stage Summary" />
              <StageSummary stageSummary={data.projects_stage_summary} title="Projects Stage Summary" />
            </div>
            <VehicleCategory vehicleCategory={d.vehicle_category} />
          </div>
        )

      case 'pipeline':
        return (
          <div className="space-y-6">
            <PipelineForecast forecast={d.forecast} />
            <StageSummary stageSummary={d.stage_summary} title="Deals Stage Summary" />
          </div>
        )

      case 'clients':
        return (
          <div className="space-y-6">
            <TopClients topClients={d.top_clients} />
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <ConcentrationRisk concentrationRisk={d.concentration_risk} />
              <DrilldownPivot drilldown={d.drilldown} />
            </div>
          </div>
        )

      case 'geo':
        return (
          <GeoFleet
            geoFleet={d.geo_fleet}
            geoFleetNested={d.geo_fleet_nested}
          />
        )

      case 'monthly_closures':
        return (
          <MonthlyClosures
            monthlyClosures={data.monthly_closures}
            monthlySummary={data.monthly_summary}
          />
        )

      case 'targets':
        return (
          <TargetsVsActuals
            monthlyClosures={data.monthly_closures}
            user={user}
          />
        )

      case 'all_records':
        return (
          <AllRecords combinedRecords={data.combined_records} />
        )

      default:
        return null
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
              <span>{data?.summary_table?.length || 0} deals · {data?.combined_records?.length || 0} total records</span>
              {uploadedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />Updated {uploadedAt}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <span className={`hidden lg:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'}`}>
              <User className="w-3 h-3" />{user.name}
            </span>
          )}
          <button onClick={toggleTheme}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
              isDark ? 'border-slate-600 bg-slate-700 text-slate-200 hover:bg-slate-600' : 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            {isDark ? <Sun className="w-4 h-4 text-yellow-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
            <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>
          </button>
          <button onClick={onReset}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${tw.uploadReset}`}>
            <UploadCloud className="w-4 h-4" />
            <span className="hidden sm:inline">New Upload</span>
          </button>
          <button onClick={onLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm text-red-500 border-red-500/30 hover:bg-red-500/10 transition-colors">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Nav Tabs */}
      <nav className={`${tw.nav} px-6 flex gap-1 flex-shrink-0 overflow-x-auto`}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
              activeTab === tab.id ? tw.tabActive : tw.tabInactive
            }`}>
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Filters — hidden on Monthly Closures and All Records tabs */}
      {!noFilterTabs.has(activeTab) && (
        <Filters data={data} filters={filters} onFiltersChange={setFilters} />
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-6">
        {renderTab()}
      </main>
    </div>
  )
}
