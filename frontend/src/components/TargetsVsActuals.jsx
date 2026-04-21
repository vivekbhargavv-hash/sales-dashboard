import React, { useEffect, useMemo, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import { Target, CheckCircle2, Clock, AlertCircle, Loader2, Save, Lock } from 'lucide-react'
import { useTheme, formatFleet } from '../ThemeContext'
import api from '../utils/api'

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function monthLabel(year, month) {
  return `${MONTH_NAMES[month - 1]}-${String(year).slice(-2)}`
}

function monthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function addMonths(year, month, delta) {
  // month is 1-12
  const idx = (year * 12 + (month - 1)) + delta
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
}

// Parse '2026-04' -> { year: 2026, month: 4 }
function parseMonthKey(key) {
  const [y, m] = String(key).split('-')
  return { year: parseInt(y, 10), month: parseInt(m, 10) }
}

function fmt(v) {
  if (v == null || Number.isNaN(v)) return '—'
  return Number(v).toLocaleString('en-IN')
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function TargetsVsActuals({ monthlyClosures, user }) {
  const { tw, isDark, ct } = useTheme()
  const [targets,  setTargets]  = useState({})   // { 'YYYY-MM': number }
  const [edits,    setEdits]    = useState({})   // pending edits not yet saved
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [okMsg,    setOkMsg]    = useState('')
  const [isAdmin,  setIsAdmin]  = useState(false)

  // ── Derive actuals per calendar month from monthly_closures ─────────────────
  const actualsByMonth = useMemo(() => {
    const out = {}
    for (const r of (monthlyClosures || [])) {
      const key = r.month_key                     // preferred
        || (r.month && /^\d{4}-\d{2}$/.test(r.month) ? r.month : null)
      if (!key) continue
      out[key] = (out[key] || 0) + (Number(r.vehicles) || 0)
    }
    return out
  }, [monthlyClosures])

  // ── Load targets from backend ───────────────────────────────────────────────
  useEffect(() => {
    let ignore = false
    setLoading(true)
    api.get('/api/targets')
      .then(({ data }) => {
        if (ignore) return
        const map = {}
        for (const t of (data.targets || [])) {
          map[monthKey(t.year, t.month)] = Number(t.target_vehicles) || 0
        }
        setTargets(map)
        setIsAdmin(!!data.is_admin)
      })
      .catch(err => {
        if (!ignore) setError(err?.response?.data?.detail || 'Failed to load targets.')
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [])

  // ── Month window: past 6 + current + next 12 = 19 months ────────────────────
  const now = new Date()
  const curY = now.getFullYear()
  const curM = now.getMonth() + 1   // 1-12
  const curKey = monthKey(curY, curM)

  const rows = useMemo(() => {
    const list = []
    // Start 6 months before current, go 12 months after
    for (let delta = -6; delta <= 12; delta++) {
      const { year, month } = addMonths(curY, curM, delta)
      const key = monthKey(year, month)
      const target = (key in edits ? edits[key] : targets[key]) ?? 0
      const actual = actualsByMonth[key] ?? 0
      let status
      if (delta < 0)       status = 'past'
      else if (delta === 0) status = 'current'
      else                  status = 'future'
      list.push({
        year, month, key,
        label: monthLabel(year, month),
        target: Number(target) || 0,
        actual: Number(actual) || 0,
        status,
      })
    }
    return list
  }, [targets, edits, actualsByMonth, curY, curM])

  // ── Cumulative totals ────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    let tgtSum = 0, actSum = 0, pastTgt = 0, pastAct = 0, curTgt = 0, curAct = 0
    for (const r of rows) {
      tgtSum += r.target
      if (r.status !== 'future') actSum += r.actual
      if (r.status === 'past')     { pastTgt += r.target; pastAct += r.actual }
      if (r.status === 'current')  { curTgt  += r.target; curAct  += r.actual }
    }
    return { tgtSum, actSum, pastTgt, pastAct, curTgt, curAct }
  }, [rows])

  // ── Chart: Target vs Actual across the window ──────────────────────────────
  const chartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: ct.tooltip.backgroundColor,
      borderColor: ct.tooltip.borderColor,
      textStyle: ct.tooltip.textStyle,
      extraCssText: ct.tooltip.extraCssText,
    },
    legend: {
      data: ['Target', 'Actual'],
      textStyle: { color: ct.text, fontSize: 11 },
      top: 0, right: 10,
    },
    grid: { left: '2%', right: '3%', top: 30, bottom: 30, containLabel: true },
    xAxis: {
      type: 'category',
      data: rows.map(r => r.label),
      axisLine:  { lineStyle: { color: ct.axisLine } },
      axisLabel: { color: ct.text, fontSize: 10, rotate: 35 },
    },
    yAxis: {
      type: 'value',
      axisLine:  { lineStyle: { color: ct.axisLine } },
      splitLine: { lineStyle: { color: ct.splitLine } },
      axisLabel: { color: ct.text, fontSize: 10, formatter: v => formatFleet(v) },
    },
    series: [
      {
        name: 'Target',
        type: 'bar',
        data: rows.map(r => r.target),
        itemStyle: { color: '#3b82f6', borderRadius: [4, 4, 0, 0] },
      },
      {
        name: 'Actual',
        type: 'bar',
        data: rows.map(r => r.status === 'future' ? null : r.actual),
        itemStyle: { color: '#10b981', borderRadius: [4, 4, 0, 0] },
      },
    ],
  }), [rows, ct])

  // ── Edit + save ─────────────────────────────────────────────────────────────
  const onEdit = (key, value) => {
    const n = value === '' ? 0 : parseFloat(value)
    if (Number.isNaN(n) || n < 0) return
    setEdits(prev => ({ ...prev, [key]: n }))
    setOkMsg('')
  }

  const hasEdits = Object.keys(edits).length > 0

  const onSave = async () => {
    if (!hasEdits) return
    setSaving(true)
    setError('')
    setOkMsg('')
    try {
      const payload = Object.entries(edits).map(([key, target_vehicles]) => {
        const { year, month } = parseMonthKey(key)
        return { year, month, target_vehicles }
      })
      await api.put('/api/targets', { targets: payload })
      // merge edits into targets
      setTargets(prev => ({ ...prev, ...edits }))
      setEdits({})
      setOkMsg(`Saved ${payload.length} target${payload.length === 1 ? '' : 's'}.`)
      setTimeout(() => setOkMsg(''), 3500)
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save targets.')
    } finally {
      setSaving(false)
    }
  }

  const onDiscard = () => { setEdits({}); setOkMsg(''); setError('') }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="py-16 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-green-500" />
        <span className={`text-sm ${tw.textSecondary}`}>Loading targets…</span>
      </div>
    )
  }

  const StatusPill = ({ status }) => {
    if (status === 'past') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400">
        <CheckCircle2 className="w-3 h-3" /> Past
      </span>
    }
    if (status === 'current') {
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-500">
        <Clock className="w-3 h-3" /> Current
      </span>
    }
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400">
      <Target className="w-3 h-3" /> Future
    </span>
  }

  const inpClass = `w-24 px-2 py-1 rounded-md border text-sm text-right tabular-nums transition-colors outline-none ${
    isDark
      ? 'bg-slate-700 border-slate-600 text-white focus:border-green-500'
      : 'bg-white border-gray-300 text-gray-900 focus:border-green-500'
  }`

  return (
    <div className="space-y-6">

      {/* ── Summary cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Cumulative Target (Window)"
          value={totals.tgtSum}
          accent="#3b82f6"
          sub="Past 6 mo + current + next 12 mo"
        />
        <SummaryCard
          label="Cumulative Actual (to date)"
          value={totals.actSum}
          accent="#10b981"
          sub="Past months + current month-to-date"
        />
        <SummaryCard
          label="Current Month Progress"
          value={totals.curAct}
          accent="#22c55e"
          sub={`of ${fmt(totals.curTgt)} target · ${
            totals.curTgt > 0 ? ((totals.curAct / totals.curTgt) * 100).toFixed(1) : '0.0'
          }%`}
        />
        <SummaryCard
          label="Past Months Achievement"
          value={totals.pastAct}
          accent="#64748b"
          sub={`of ${fmt(totals.pastTgt)} target · ${
            totals.pastTgt > 0 ? ((totals.pastAct / totals.pastTgt) * 100).toFixed(1) : '0.0'
          }%`}
        />
      </div>

      {/* ── Chart ───────────────────────────────────────────────────────────── */}
      <div className={`${tw.card} rounded-2xl p-5`}>
        <div className="flex items-center justify-between mb-3">
          <h2 className={`font-semibold ${tw.textPrimary}`}>Target vs Actual — Monthly Trend</h2>
          <span className={`text-xs ${tw.textMuted}`}>
            {rows[0].label} → {rows[rows.length - 1].label}
          </span>
        </div>
        <ReactECharts option={chartOption} style={{ height: 280, width: '100%' }} notMerge lazyUpdate />
      </div>

      {/* ── Editable table ──────────────────────────────────────────────────── */}
      <div className={`${tw.card} rounded-2xl overflow-hidden`}>
        <div className={`px-5 py-4 flex items-center justify-between gap-3 border-b ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-green-500" />
            <h2 className={`font-semibold ${tw.textPrimary}`}>Monthly Targets vs Actuals</h2>
            {!isAdmin && (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                isDark ? 'bg-slate-700 text-slate-300' : 'bg-gray-100 text-gray-600'
              }`}>
                <Lock className="w-3 h-3" /> Read-only
              </span>
            )}
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2">
              {okMsg && <span className="text-xs text-green-500">{okMsg}</span>}
              {hasEdits && (
                <>
                  <button onClick={onDiscard} disabled={saving}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      isDark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } disabled:opacity-60`}>
                    Discard
                  </button>
                  <button onClick={onSave} disabled={saving}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-green-600 hover:bg-green-500 disabled:opacity-60">
                    {saving
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving…</>
                      : <><Save className="w-3.5 h-3.5" />Save {Object.keys(edits).length} change{Object.keys(edits).length === 1 ? '' : 's'}</>
                    }
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mx-5 mt-4 flex items-start gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5" />
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={`${isDark ? 'bg-slate-800' : 'bg-white'} ${tw.divider}`}>
              <tr>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-green-600">Month</th>
                <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wide text-green-600">Status</th>
                <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-green-600">Target (Vehicles)</th>
                <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-green-600">Actual (Vehicles)</th>
                <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-green-600">Variance</th>
                <th className="py-3 px-4 text-right text-xs font-semibold uppercase tracking-wide text-green-600">% Complete</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const alt = i % 2 === 0 ? (isDark ? 'bg-slate-700/20' : 'bg-gray-50') : ''
                const isFuture  = r.status === 'future'
                const isCurrent = r.status === 'current'
                const showActual = !isFuture
                const variance = showActual ? (r.actual - r.target) : null
                const pct      = r.target > 0 && showActual ? (r.actual / r.target) * 100 : null

                const edited   = r.key in edits
                const targetVal = edited ? edits[r.key] : r.target

                return (
                  <tr key={r.key} className={`border-b ${tw.borderHalf} ${alt} ${
                    isCurrent ? (isDark ? 'bg-green-500/5' : 'bg-green-50') : ''
                  }`}>
                    <td className={`py-2.5 px-4 font-medium ${tw.textBody} whitespace-nowrap`}>{r.label}</td>
                    <td className="py-2.5 px-4"><StatusPill status={r.status} /></td>

                    {/* Target cell: editable for admin */}
                    <td className="py-2.5 px-4 text-right">
                      {isAdmin ? (
                        <input
                          type="number" min="0" step="1"
                          className={inpClass + (edited ? ' border-green-500 ring-1 ring-green-500/40' : '')}
                          value={targetVal}
                          onChange={e => onEdit(r.key, e.target.value)}
                        />
                      ) : (
                        <span className={`tabular-nums ${tw.textVal}`}>{fmt(r.target)}</span>
                      )}
                    </td>

                    {/* Actual cell */}
                    <td className={`py-2.5 px-4 text-right tabular-nums ${tw.textVal}`}>
                      {showActual ? fmt(r.actual) : <span className={tw.textMuted}>—</span>}
                    </td>

                    {/* Variance */}
                    <td className={`py-2.5 px-4 text-right tabular-nums font-semibold ${
                      variance == null
                        ? tw.textMuted
                        : variance >= 0
                          ? 'text-green-500'
                          : 'text-red-500'
                    }`}>
                      {variance == null ? '—' : `${variance > 0 ? '+' : ''}${fmt(variance)}`}
                    </td>

                    {/* % Complete */}
                    <td className={`py-2.5 px-4 text-right tabular-nums ${tw.textSecondary}`}>
                      {pct == null ? '—' : `${pct.toFixed(1)}%`}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className={`border-t-2 ${tw.border} ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
                <td colSpan={2} className={`py-3 px-4 text-sm font-semibold ${tw.textSecondary}`}>Cumulative (Window)</td>
                <td className={`py-3 px-4 text-right text-sm font-bold tabular-nums text-blue-500`}>{fmt(totals.tgtSum)}</td>
                <td className={`py-3 px-4 text-right text-sm font-bold tabular-nums text-green-500`}>{fmt(totals.actSum)}</td>
                <td className={`py-3 px-4 text-right text-sm font-bold tabular-nums ${
                  totals.actSum - totals.pastTgt - totals.curTgt >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {(() => {
                    const v = totals.actSum - (totals.pastTgt + totals.curTgt)
                    return v >= 0 ? `+${fmt(v)}` : fmt(v)
                  })()}
                </td>
                <td className={`py-3 px-4 text-right text-sm font-bold tabular-nums ${tw.textSecondary}`}>
                  {(() => {
                    const den = totals.pastTgt + totals.curTgt
                    return den > 0 ? `${(totals.actSum / den * 100).toFixed(1)}%` : '—'
                  })()}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {!isAdmin && (
          <div className={`px-5 py-3 text-xs border-t ${isDark ? 'border-slate-700 text-slate-400' : 'border-gray-100 text-gray-500'}`}>
            Targets are managed by the admin. Contact your admin to change them.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Summary card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, accent, sub }) {
  const { tw } = useTheme()
  return (
    <div className={`${tw.card} rounded-xl p-4 border-l-4`} style={{ borderLeftColor: accent }}>
      <p className={`text-xs font-medium uppercase tracking-wide mb-1.5 ${tw.textMuted}`}>{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${tw.textPrimary}`}>{fmt(value)}</p>
      {sub && <p className={`text-xs mt-1.5 ${tw.textSecondary}`}>{sub}</p>}
    </div>
  )
}
