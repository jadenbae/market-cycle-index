import { CATEGORY_WEIGHTS, INDICATOR_CATEGORIES, INDICATOR_DIRECTION } from './types'

/**
 * Returns the percentile rank (0–100) of `value` within `history`.
 * Percentage of historical values strictly below `value`.
 */
export function percentileRank(value: number, history: number[]): number {
  if (history.length === 0) return 50
  const below = history.filter(v => v < value).length
  return Math.round((below / history.length) * 100)
}

/**
 * Converts a raw indicator value to a sub-score (1–100) where
 * 100 = peak territory, 1 = trough territory.
 */
export function computeSubScore(
  value: number,
  history: number[],
  direction: 'higher_is_peak' | 'lower_is_peak'
): number {
  const pct = percentileRank(value, history)
  const score = direction === 'higher_is_peak' ? pct : 100 - pct
  return Math.max(1, Math.min(100, score))
}

/**
 * Computes the rule-based composite score from 19 indicator sub-scores.
 * Returns a number 1–100.
 */
export function computeRuleScore(subScores: Record<string, number>): number {
  let total = 0

  for (const [category, indicators] of Object.entries(INDICATOR_CATEGORIES)) {
    const weight = CATEGORY_WEIGHTS[category as keyof typeof CATEGORY_WEIGHTS]
    const categoryAvg =
      indicators.reduce((sum, key) => sum + (subScores[key] ?? 50), 0) / indicators.length
    total += categoryAvg * weight
  }

  return Math.round(Math.max(1, Math.min(100, total)))
}

/**
 * Computes all 19 sub-scores given current values and historical baselines.
 */
export function computeAllSubScores(
  currentValues: Record<string, number>,
  historicalData: Record<string, number[]>
): Record<string, number> {
  const subScores: Record<string, number> = {}

  for (const [key, value] of Object.entries(currentValues)) {
    const history = historicalData[key] ?? []
    const direction = INDICATOR_DIRECTION[key] ?? 'higher_is_peak'
    subScores[key] = computeSubScore(value, history, direction)
  }

  return subScores
}
