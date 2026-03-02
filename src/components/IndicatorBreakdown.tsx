'use client'
import { useState } from 'react'
import type { WeeklySnapshot } from '@/lib/types'
import { INDICATOR_CATEGORIES } from '@/lib/types'

const CATEGORY_LABELS: Record<string, string> = {
  valuation: 'Valuation',
  macro: 'Macro Backdrop',
  credit: 'Credit & Leverage',
  sentiment: 'Market Behavior & Sentiment',
}

const INDICATOR_LABELS: Record<string, string> = {
  cape: 'CAPE / Shiller P/E',
  sp500_pe: 'S&P 500 Trailing P/E',
  equity_risk_premium: 'Equity Risk Premium (%)',
  hy_credit_spread: 'High Yield Spread (bps)',
  ig_credit_spread: 'Investment Grade Spread (bps)',
  fed_funds_rate: 'Fed Funds Rate (%)',
  core_pce: 'Core PCE Inflation YoY (%)',
  gdp_growth: 'GDP Growth Rate (%)',
  unemployment: 'Unemployment Rate (%)',
  sp500_net_margin: 'S&P 500 Net Profit Margin (%)',
  covenant_quality: "Covenant Quality Index (Moody's)",
  corporate_debt_gdp: 'Corporate Debt / GDP (%)',
  loan_officer_tightening: 'Loan Officer Tightening (%)',
  ipo_volume: 'IPO Volume (trailing 12m)',
  ipo_unprofitable_pct: 'Unprofitable IPOs (%)',
  aaii_bull_bear_spread: 'AAII Bull–Bear Spread (%)',
  vix: 'VIX (Implied Volatility)',
  margin_debt_yoy: 'NYSE Margin Debt YoY (%)',
  pct_above_200dma: 'S&P 500 Stocks Above 200-DMA (%)',
}

function subScoreColor(score: number): string {
  if (score > 70) return 'text-red-500'
  if (score > 40) return 'text-amber-500'
  return 'text-green-600'
}

interface Props {
  snapshot: WeeklySnapshot
}

export function IndicatorBreakdown({ snapshot }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ valuation: true })

  const toggle = (cat: string) =>
    setExpanded(prev => ({ ...prev, [cat]: !prev[cat] }))

  return (
    <div className="space-y-2">
      {(Object.entries(INDICATOR_CATEGORIES) as [string, readonly string[]][]).map(([category, keys]) => (
        <div key={category} className="border border-gray-100 rounded-lg overflow-hidden">
          <button
            onClick={() => toggle(category)}
            className="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
          >
            <span>{CATEGORY_LABELS[category] ?? category}</span>
            <span className="text-gray-400 text-xs">{expanded[category] ? '▲' : '▼'}</span>
          </button>
          {expanded[category] && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100 bg-white">
                  <th className="text-left px-4 py-2 font-medium">Indicator</th>
                  <th className="text-right px-4 py-2 font-medium">Current Value</th>
                  <th className="text-right px-4 py-2 font-medium">Sub-Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {keys.map(key => {
                  const ind = snapshot.indicators[key as keyof typeof snapshot.indicators]
                  return (
                    <tr key={key} className="bg-white hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-600">{INDICATOR_LABELS[key] ?? key}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-gray-700">
                        {ind?.value != null ? ind.value.toFixed(2) : '—'}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-bold ${subScoreColor(ind?.sub_score ?? 50)}`}>
                        {ind?.sub_score ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  )
}
