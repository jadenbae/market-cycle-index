export interface IndicatorValue {
  value: number
  sub_score: number  // 1–100, higher = more peak-like
}

export interface WeeklySnapshot {
  date: string  // YYYY-MM-DD (Monday)
  rule_score: number
  claude_score: number
  commentary: string
  indicators: {
    // Valuation
    cape: IndicatorValue
    sp500_pe: IndicatorValue
    equity_risk_premium: IndicatorValue
    hy_credit_spread: IndicatorValue
    ig_credit_spread: IndicatorValue
    // Macro
    fed_funds_rate: IndicatorValue
    core_pce: IndicatorValue
    gdp_growth: IndicatorValue
    unemployment: IndicatorValue
    sp500_net_margin: IndicatorValue
    // Credit & Leverage
    covenant_quality: IndicatorValue
    corporate_debt_gdp: IndicatorValue
    loan_officer_tightening: IndicatorValue
    // Sentiment & Behavior
    ipo_volume: IndicatorValue
    ipo_unprofitable_pct: IndicatorValue
    aaii_bull_bear_spread: IndicatorValue
    vix: IndicatorValue
    margin_debt_yoy: IndicatorValue
    pct_above_200dma: IndicatorValue
  }
}

export interface HistoryData {
  snapshots: WeeklySnapshot[]
}

export const CATEGORY_WEIGHTS = {
  valuation: 0.30,
  macro: 0.20,
  credit: 0.20,
  sentiment: 0.30,
} as const

export const INDICATOR_CATEGORIES = {
  valuation: ['cape', 'sp500_pe', 'equity_risk_premium', 'hy_credit_spread', 'ig_credit_spread'],
  macro: ['fed_funds_rate', 'core_pce', 'gdp_growth', 'unemployment', 'sp500_net_margin'],
  credit: ['covenant_quality', 'corporate_debt_gdp', 'loan_officer_tightening'],
  sentiment: ['ipo_volume', 'ipo_unprofitable_pct', 'aaii_bull_bear_spread', 'vix', 'margin_debt_yoy', 'pct_above_200dma'],
} as const

// Whether higher value = more peak-like (true) or lower value = more peak-like (false)
export const INDICATOR_DIRECTION: Record<string, 'higher_is_peak' | 'lower_is_peak'> = {
  cape: 'higher_is_peak',
  sp500_pe: 'higher_is_peak',
  equity_risk_premium: 'lower_is_peak',    // low ERP = expensive equities = peak
  hy_credit_spread: 'lower_is_peak',       // tight spreads = peak
  ig_credit_spread: 'lower_is_peak',
  fed_funds_rate: 'higher_is_peak',        // high rates = late cycle
  core_pce: 'higher_is_peak',
  gdp_growth: 'higher_is_peak',            // hot growth = peak
  unemployment: 'lower_is_peak',           // low unemployment = peak
  sp500_net_margin: 'higher_is_peak',
  covenant_quality: 'lower_is_peak',       // Moody's: lower = weaker covenants = peak
  corporate_debt_gdp: 'higher_is_peak',
  loan_officer_tightening: 'lower_is_peak', // negative = loose standards = peak
  ipo_volume: 'higher_is_peak',
  ipo_unprofitable_pct: 'higher_is_peak',
  aaii_bull_bear_spread: 'higher_is_peak', // high bulls = peak
  vix: 'lower_is_peak',                    // low VIX = complacency = peak
  margin_debt_yoy: 'higher_is_peak',
  pct_above_200dma: 'higher_is_peak',
}
