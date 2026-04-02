import React, { createContext, useContext, useState, useEffect } from 'react'

const ThemeContext = createContext()

export const STAGE_ORDER = [
  'New', 'Requirements Gathering', 'Proposal Sent', 'Negotiation',
  'Contracting', 'Closed Won', 'Pending Deployment', 'Dormant', 'Closed Lost'
]

export const STAGE_COLORS = {
  'New': '#64748b',
  'Requirements Gathering': '#3b82f6',
  'Proposal Sent': '#06b6d4',
  'Negotiation': '#f59e0b',
  'Contracting': '#8b5cf6',
  'Closed Won': '#10b981',
  'Pending Deployment': '#6366f1',
  'Dormant': '#475569',
  'Closed Lost': '#ef4444',
}

// Fleet size: just a plain integer (number of vehicles)
export const formatFleet = (val) => {
  if (!val && val !== 0) return '0'
  return new Intl.NumberFormat('en-IN').format(Math.round(val || 0))
}

export const formatNum = (val) => {
  if (!val && val !== 0) return '0'
  return new Intl.NumberFormat('en-IN').format(Math.round(val || 0))
}

export function sortByStageOrder(arr, stageKey = 'stage') {
  return [...arr].sort((a, b) => {
    const ai = STAGE_ORDER.indexOf(a[stageKey])
    const bi = STAGE_ORDER.indexOf(b[stageKey])
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
  })
}

// Dark theme Tailwind class map
const DARK = {
  root: 'bg-slate-900 text-slate-100',
  header: 'bg-slate-800 border-b border-slate-700',
  nav: 'bg-slate-800/80 border-b border-slate-700',
  filter: 'bg-slate-800/60 border-b border-slate-700',
  card: 'bg-slate-800 border border-slate-700',
  cardInner: 'bg-slate-700/50',
  cardInnerBorder: 'bg-slate-700/30 border border-slate-600/50',
  hover: 'hover:bg-slate-700/30',
  rowHover: 'hover:bg-slate-700/40',
  border: 'border-slate-700',
  borderHalf: 'border-slate-700/50',
  divider: 'border-b border-slate-700',
  textPrimary: 'text-white',
  textBody: 'text-slate-200',
  textSecondary: 'text-slate-400',
  textMuted: 'text-slate-600',
  textVal: 'text-slate-300',
  tabActive: 'text-blue-400 border-blue-400',
  tabInactive: 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-500',
  filterBtn: 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600',
  filterBtnActive: 'border-blue-500 bg-blue-900/20 text-blue-300',
  filterBadge: 'bg-blue-600 text-white',
  filterDropdown: 'bg-slate-800 border border-slate-700',
  filterOption: 'hover:bg-slate-700',
  filterOptionText: 'text-slate-200',
  uploadReset: 'bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600',
  sectionTitle: 'text-white',
  subTitle: 'text-slate-400',
  accentColor: '#22c55e',
}

// Light theme Tailwind class map
const LIGHT = {
  root: 'bg-gray-50 text-gray-900',
  header: 'bg-white border-b border-gray-200 shadow-sm',
  nav: 'bg-white border-b border-gray-200',
  filter: 'bg-gray-50 border-b border-gray-200',
  card: 'bg-white border border-gray-200 shadow-sm',
  cardInner: 'bg-gray-50',
  cardInnerBorder: 'bg-gray-50 border border-gray-200',
  hover: 'hover:bg-gray-50',
  rowHover: 'hover:bg-gray-50',
  border: 'border-gray-200',
  borderHalf: 'border-gray-200/70',
  divider: 'border-b border-gray-200',
  textPrimary: 'text-gray-900',
  textBody: 'text-gray-700',
  textSecondary: 'text-gray-500',
  textMuted: 'text-gray-400',
  textVal: 'text-gray-600',
  tabActive: 'text-green-600 border-green-600',
  tabInactive: 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300',
  filterBtn: 'border-gray-300 bg-white text-gray-600 hover:border-gray-400',
  filterBtnActive: 'border-green-500 bg-green-50 text-green-700',
  filterBadge: 'bg-green-600 text-white',
  filterDropdown: 'bg-white border border-gray-200 shadow-xl',
  filterOption: 'hover:bg-gray-50',
  filterOptionText: 'text-gray-700',
  uploadReset: 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300',
  sectionTitle: 'text-gray-900',
  subTitle: 'text-gray-500',
  accentColor: '#16a34a',
}

// ECharts theme configs
function buildChartTheme(isDark) {
  return {
    bg: 'transparent',
    text: isDark ? '#94a3b8' : '#64748b',
    axisLine: isDark ? '#334155' : '#e2e8f0',
    splitLine: isDark ? '#1e293b' : '#f1f5f9',
    tooltip: {
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      textStyle: { color: isDark ? '#cbd5e1' : '#1e293b' },
      extraCssText: isDark
        ? 'box-shadow: 0 4px 16px rgba(0,0,0,0.5)'
        : 'box-shadow: 0 4px 16px rgba(0,0,0,0.12)',
    },
    legend: { textStyle: { color: isDark ? '#94a3b8' : '#64748b' } },
  }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('moeving_theme') || 'dark' } catch { return 'dark' }
  })

  useEffect(() => {
    try { localStorage.setItem('moeving_theme', theme) } catch {}
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')
  const isDark = theme === 'dark'
  const tw = isDark ? DARK : LIGHT
  const ct = buildChartTheme(isDark)

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, tw, ct }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
