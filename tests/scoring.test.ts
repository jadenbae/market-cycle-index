import { describe, it, expect } from 'vitest'
import { percentileRank, computeSubScore, computeRuleScore } from '../src/lib/scoring'

describe('percentileRank', () => {
  it('returns ~50 for median value', () => {
    // With strictly-below: 4 of 10 values are below 5 → 40th percentile
    const history = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(percentileRank(5, history)).toBeGreaterThan(35)
    expect(percentileRank(5, history)).toBeLessThan(65)
  })

  it('returns high percentile for max value', () => {
    const history = [1, 2, 3, 4, 5]
    expect(percentileRank(5, history)).toBeGreaterThan(70)
  })

  it('returns low percentile for min value', () => {
    const history = [1, 2, 3, 4, 5]
    expect(percentileRank(1, history)).toBeLessThan(25)
  })

  it('returns 50 for empty history', () => {
    expect(percentileRank(100, [])).toBe(50)
  })
})

describe('computeSubScore', () => {
  it('returns high score for high value when higher_is_peak', () => {
    const history = [10, 20, 30, 40, 50]
    const score = computeSubScore(50, history, 'higher_is_peak')
    expect(score).toBeGreaterThanOrEqual(80)
  })

  it('returns high score for low value when lower_is_peak', () => {
    const history = [10, 20, 30, 40, 50]
    const score = computeSubScore(10, history, 'lower_is_peak')
    expect(score).toBeGreaterThanOrEqual(80)
  })

  it('clamps result between 1 and 100', () => {
    const history = [10, 20, 30]
    expect(computeSubScore(10, history, 'higher_is_peak')).toBeGreaterThanOrEqual(1)
    expect(computeSubScore(30, history, 'higher_is_peak')).toBeLessThanOrEqual(100)
  })
})

describe('computeRuleScore', () => {
  it('returns weighted average of category scores', () => {
    // All sub-scores at 60 → rule score should be 60
    const subScores = Object.fromEntries(
      ['cape','sp500_pe','equity_risk_premium','hy_credit_spread','ig_credit_spread',
       'fed_funds_rate','core_pce','gdp_growth','unemployment','sp500_net_margin',
       'covenant_quality','corporate_debt_gdp','loan_officer_tightening',
       'ipo_volume','ipo_unprofitable_pct','aaii_bull_bear_spread','vix',
       'margin_debt_yoy','pct_above_200dma'].map(k => [k, 60])
    )
    expect(computeRuleScore(subScores)).toBeCloseTo(60, 0)
  })

  it('returns higher score when valuation indicators are high', () => {
    const subScores = Object.fromEntries(
      ['cape','sp500_pe','equity_risk_premium','hy_credit_spread','ig_credit_spread',
       'fed_funds_rate','core_pce','gdp_growth','unemployment','sp500_net_margin',
       'covenant_quality','corporate_debt_gdp','loan_officer_tightening',
       'ipo_volume','ipo_unprofitable_pct','aaii_bull_bear_spread','vix',
       'margin_debt_yoy','pct_above_200dma'].map(k => [k, 50])
    )
    // Bump valuation indicators to 90
    const highValuation = { ...subScores, cape: 90, sp500_pe: 90, equity_risk_premium: 90, hy_credit_spread: 90, ig_credit_spread: 90 }
    expect(computeRuleScore(highValuation)).toBeGreaterThan(computeRuleScore(subScores))
  })

  it('clamps result between 1 and 100', () => {
    const allZero = Object.fromEntries(
      ['cape','sp500_pe','equity_risk_premium','hy_credit_spread','ig_credit_spread',
       'fed_funds_rate','core_pce','gdp_growth','unemployment','sp500_net_margin',
       'covenant_quality','corporate_debt_gdp','loan_officer_tightening',
       'ipo_volume','ipo_unprofitable_pct','aaii_bull_bear_spread','vix',
       'margin_debt_yoy','pct_above_200dma'].map(k => [k, 0])
    )
    const allHundred = Object.fromEntries(
      ['cape','sp500_pe','equity_risk_premium','hy_credit_spread','ig_credit_spread',
       'fed_funds_rate','core_pce','gdp_growth','unemployment','sp500_net_margin',
       'covenant_quality','corporate_debt_gdp','loan_officer_tightening',
       'ipo_volume','ipo_unprofitable_pct','aaii_bull_bear_spread','vix',
       'margin_debt_yoy','pct_above_200dma'].map(k => [k, 100])
    )
    expect(computeRuleScore(allZero)).toBeGreaterThanOrEqual(1)
    expect(computeRuleScore(allHundred)).toBeLessThanOrEqual(100)
  })
})
