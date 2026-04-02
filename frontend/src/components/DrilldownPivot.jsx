import React, { useState, useMemo } from 'react'
import { ChevronRight, ArrowLeft } from 'lucide-react'
import { useTheme, STAGE_ORDER, STAGE_COLORS, sortByStageOrder, formatFleet } from '../ThemeContext'

export default function DrilldownPivot({ drilldown }) {
  const [selectedStage, setSelectedStage] = useState(null)
  const [selectedCity, setSelectedCity] = useState(null)
  const { tw } = useTheme()

  const stageData = useMemo(() => {
    if (!drilldown) return []
    const map = {}
    drilldown.forEach(row => {
      if (!map[row.stage]) map[row.stage] = { count: 0, total_deal_size: 0 }
      map[row.stage].count += row.count || 0
      map[row.stage].total_deal_size += row.total_deal_size || 0
    })
    // Sort by STAGE_ORDER
    return sortByStageOrder(
      Object.entries(map).map(([stage, v]) => ({ stage, ...v }))
    )
  }, [drilldown])

  const cityData = useMemo(() => {
    if (!drilldown || !selectedStage) return []
    const map = {}
    drilldown
      .filter(row => row.stage === selectedStage)
      .forEach(row => {
        if (!map[row.city]) map[row.city] = { count: 0, total_deal_size: 0 }
        map[row.city].count += row.count || 0
        map[row.city].total_deal_size += row.total_deal_size || 0
      })
    return Object.entries(map)
      .map(([city, v]) => ({ city, ...v }))
      .sort((a, b) => b.total_deal_size - a.total_deal_size)
  }, [drilldown, selectedStage])

  const clientData = useMemo(() => {
    if (!drilldown || !selectedStage || !selectedCity) return []
    return drilldown
      .filter(row => row.stage === selectedStage && row.city === selectedCity)
      .sort((a, b) => (b.total_deal_size || 0) - (a.total_deal_size || 0))
  }, [drilldown, selectedStage, selectedCity])

  const level = selectedCity ? 3 : selectedStage ? 2 : 1

  const thClass = `text-right py-2 px-3 font-medium ${tw.textSecondary}`
  const tdClass = `text-right py-2.5 px-3 ${tw.textVal}`

  return (
    <div className={`${tw.card} rounded-xl p-5`}>
      <h2 className={`text-lg font-semibold mb-4 pb-2 ${tw.divider} ${tw.sectionTitle}`}>
        Drilldown Pivot
      </h2>

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4 text-sm flex-wrap">
        <button
          onClick={() => { setSelectedStage(null); setSelectedCity(null) }}
          className={`transition-colors ${level === 1 ? 'text-green-500 font-medium' : `${tw.textSecondary} hover:${tw.textBody} cursor-pointer`}`}
        >
          All Stages
        </button>
        {selectedStage && (
          <>
            <ChevronRight className={`w-4 h-4 ${tw.textMuted}`} />
            <button
              onClick={() => setSelectedCity(null)}
              className={`transition-colors ${level === 2 ? 'text-green-500 font-medium' : `${tw.textSecondary} hover:${tw.textBody} cursor-pointer`}`}
            >
              {selectedStage}
            </button>
          </>
        )}
        {selectedCity && (
          <>
            <ChevronRight className={`w-4 h-4 ${tw.textMuted}`} />
            <span className="text-green-500 font-medium">{selectedCity}</span>
          </>
        )}
      </div>

      {/* Back button */}
      {level > 1 && (
        <button
          onClick={() => {
            if (level === 3) setSelectedCity(null)
            else { setSelectedStage(null); setSelectedCity(null) }
          }}
          className={`flex items-center gap-1.5 text-sm mb-3 transition-colors ${tw.textSecondary} hover:${tw.textPrimary}`}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
      )}

      {/* Level 1: Stages */}
      {level === 1 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={tw.divider}>
                <th className={`text-left py-2 pr-3 font-medium ${tw.textSecondary}`}>Stage</th>
                <th className={thClass}>Opportunities</th>
                <th className={thClass}>Fleet Size (Vehicles)</th>
              </tr>
            </thead>
            <tbody>
              {stageData.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b ${tw.borderHalf} ${tw.rowHover} cursor-pointer transition-colors`}
                  onClick={() => setSelectedStage(row.stage)}
                >
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: STAGE_COLORS[row.stage] || '#64748b' }} />
                      <span className={tw.textBody}>{row.stage}</span>
                      <ChevronRight className={`w-3.5 h-3.5 ${tw.textMuted} ml-auto`} />
                    </span>
                  </td>
                  <td className={tdClass}>{row.count}</td>
                  <td className={tdClass}>{formatFleet(row.total_deal_size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={`text-xs mt-3 ${tw.textMuted}`}>Click a stage to drill down by city</p>
        </div>
      )}

      {/* Level 2: Cities within stage */}
      {level === 2 && (
        <div className="overflow-x-auto">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: STAGE_COLORS[selectedStage] || '#64748b' }} />
            <span className={`font-medium ${tw.textPrimary}`}>{selectedStage}</span>
            <span className={`text-sm ${tw.textSecondary}`}>— {cityData.length} cities</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className={tw.divider}>
                <th className={`text-left py-2 pr-3 font-medium ${tw.textSecondary}`}>City</th>
                <th className={thClass}>Opportunities</th>
                <th className={thClass}>Fleet Size (Vehicles)</th>
              </tr>
            </thead>
            <tbody>
              {cityData.map((row, i) => (
                <tr
                  key={i}
                  className={`border-b ${tw.borderHalf} ${tw.rowHover} cursor-pointer transition-colors`}
                  onClick={() => setSelectedCity(row.city)}
                >
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2">
                      <span className={tw.textBody}>{row.city}</span>
                      <ChevronRight className={`w-3.5 h-3.5 ${tw.textMuted} ml-auto`} />
                    </span>
                  </td>
                  <td className={tdClass}>{row.count}</td>
                  <td className={tdClass}>{formatFleet(row.total_deal_size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className={`text-xs mt-3 ${tw.textMuted}`}>Click a city to see individual clients</p>
        </div>
      )}

      {/* Level 3: Clients within stage + city */}
      {level === 3 && (
        <div className="overflow-x-auto">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: STAGE_COLORS[selectedStage] || '#64748b' }} />
            <span className={tw.textSecondary}>{selectedStage}</span>
            <ChevronRight className={`w-3.5 h-3.5 ${tw.textMuted}`} />
            <span className={`font-medium ${tw.textPrimary}`}>{selectedCity}</span>
            <span className={`text-sm ${tw.textSecondary}`}>— {clientData.length} clients</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className={tw.divider}>
                <th className={`text-left py-2 pr-3 font-medium ${tw.textSecondary}`}>Client</th>
                <th className={thClass}>Opportunities</th>
                <th className={thClass}>Fleet Size (Vehicles)</th>
              </tr>
            </thead>
            <tbody>
              {clientData.map((row, i) => (
                <tr key={i} className={`border-b ${tw.borderHalf} ${tw.hover} transition-colors`}>
                  <td className={`py-2.5 pr-3 ${tw.textBody}`}>{row.client_name}</td>
                  <td className={tdClass}>{row.count}</td>
                  <td className={tdClass}>{formatFleet(row.total_deal_size)}</td>
                </tr>
              ))}
              {clientData.length === 0 && (
                <tr>
                  <td colSpan={3} className={`py-6 text-center ${tw.textSecondary}`}>No clients found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
