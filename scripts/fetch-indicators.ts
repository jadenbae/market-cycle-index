const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations'

interface FredObservation {
  date: string
  value: string
}

async function fetchFredLatest(seriesId: string): Promise<number> {
  const apiKey = process.env.FRED_API_KEY!
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=5`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FRED error ${seriesId}: ${res.status}`)
  const json = await res.json() as { observations: FredObservation[] }
  const obs = json.observations.find(o => o.value !== '.' && o.value !== '')
  if (!obs) throw new Error(`No valid data for ${seriesId}`)
  return parseFloat(obs.value)
}

async function fetchFredYoY(seriesId: string): Promise<number> {
  const apiKey = process.env.FRED_API_KEY!
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=14&frequency=m`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FRED YoY error ${seriesId}: ${res.status}`)
  const json = await res.json() as { observations: FredObservation[] }
  const obs = json.observations
    .filter(o => o.value !== '.' && o.value !== '')
    .map(o => parseFloat(o.value))
  if (obs.length < 13) throw new Error(`Insufficient data for YoY calc: ${seriesId}`)
  return ((obs[0] - obs[12]) / Math.abs(obs[12])) * 100
}

async function fetchShillerCAPE(): Promise<number> {
  try {
    const res = await fetch('https://www.multpl.com/shiller-pe/table/by-month', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MarketCycleIndex/1.0)' }
    })
    const html = await res.text()
    // Find first table row with a decimal number
    const match = html.match(/id="m\d+"[^>]*>\s*[\w\s,]+<\/td>\s*<td[^>]*>\s*([\d.]+)\s*<\/td>/)
    if (match) return parseFloat(match[1])
    // Fallback: find any number between 10 and 60 preceded by table cell markup
    const fallback = html.match(/<td[^>]*>\s*((?:1|2|3|4|5)[0-9]\.[0-9]+)\s*<\/td>/)
    if (fallback) return parseFloat(fallback[1])
  } catch {
    console.warn('Could not fetch CAPE from multpl.com, using fallback value')
  }
  return 36  // fallback: approximate current CAPE
}

export async function fetchAllIndicators(): Promise<Record<string, number>> {
  console.log('Fetching current indicator values...')

  const [
    fedFunds,
    corePce,
    gdpGrowth,
    unemployment,
    hyCreditSpread,
    igCreditSpread,
    corporateDebtRaw,
    nominalGdp,
    loanOfficer,
    vix,
    tenYearTreasury,
    cape,
  ] = await Promise.all([
    fetchFredLatest('FEDFUNDS'),
    fetchFredYoY('PCEPILFE'),
    fetchFredLatest('A191RL1Q225SBEA'),
    fetchFredLatest('UNRATE'),
    fetchFredLatest('BAMLH0A0HYM2'),
    fetchFredLatest('BAMLC0A0CM'),
    fetchFredLatest('BCNSDODNS'),
    fetchFredLatest('GDP'),
    fetchFredLatest('DRTSCILM'),
    fetchFredLatest('VIXCLS'),
    fetchFredLatest('GS10'),
    fetchShillerCAPE(),
  ])

  const sp500Pe = cape * 0.72  // trailing P/E approximation from CAPE
  const earningsYield = (1 / sp500Pe) * 100
  const equityRiskPremium = earningsYield - tenYearTreasury
  const corporateDebtGdp = (corporateDebtRaw / nominalGdp) * 100

  const indicators: Record<string, number> = {
    // Valuation
    cape,
    sp500_pe: sp500Pe,
    equity_risk_premium: equityRiskPremium,
    hy_credit_spread: hyCreditSpread,
    ig_credit_spread: igCreditSpread,
    // Macro
    fed_funds_rate: fedFunds,
    core_pce: corePce,
    gdp_growth: gdpGrowth,
    unemployment,
    sp500_net_margin: 11.5,         // placeholder: update from macrotrends quarterly
    // Credit & Leverage
    covenant_quality: 3.8,          // placeholder: update from Moody's monthly PDF
    corporate_debt_gdp: corporateDebtGdp,
    loan_officer_tightening: loanOfficer,
    // Sentiment & Behavior
    ipo_volume: 180,                 // placeholder: update from Renaissance Capital
    ipo_unprofitable_pct: 55,        // placeholder: update from Renaissance Capital
    aaii_bull_bear_spread: 15,       // placeholder: update from AAII weekly
    vix,
    margin_debt_yoy: 12,             // placeholder: update from FINRA monthly
    pct_above_200dma: 62,            // placeholder: update from Barchart
  }

  console.log('Fetched indicators:')
  for (const [k, v] of Object.entries(indicators)) {
    console.log(`  ${k}: ${typeof v === 'number' ? v.toFixed(2) : v}`)
  }

  return indicators
}
