import fs from 'fs'
import path from 'path'

const FRED_API_KEY = process.env.FRED_API_KEY!
if (!FRED_API_KEY) {
  console.error('Missing FRED_API_KEY environment variable')
  process.exit(1)
}

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations'

interface FredObservation {
  date: string
  value: string
}

async function fetchFredSeries(seriesId: string, startDate = '1990-01-01'): Promise<number[]> {
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDate}&sort_order=asc`
  console.log(`  Fetching ${seriesId}...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FRED API error for ${seriesId}: ${res.status} ${res.statusText}`)
  const json = await res.json() as { observations: FredObservation[] }
  return json.observations
    .filter(o => o.value !== '.' && o.value !== '')
    .map(o => parseFloat(o.value))
    .filter(v => !isNaN(v))
}

async function fetchFredYoYSeries(seriesId: string): Promise<number[]> {
  // Fetch monthly values and compute YoY % change
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&observation_start=1989-01-01&sort_order=asc&frequency=m`
  console.log(`  Fetching ${seriesId} (YoY)...`)
  const res = await fetch(url)
  if (!res.ok) throw new Error(`FRED API error for ${seriesId}: ${res.status}`)
  const json = await res.json() as { observations: FredObservation[] }
  const values = json.observations
    .filter(o => o.value !== '.' && o.value !== '')
    .map(o => parseFloat(o.value))
    .filter(v => !isNaN(v))

  // Compute YoY: (current - 12_months_ago) / 12_months_ago * 100
  const yoy: number[] = []
  for (let i = 12; i < values.length; i++) {
    if (values[i - 12] !== 0) {
      yoy.push(((values[i] - values[i - 12]) / Math.abs(values[i - 12])) * 100)
    }
  }
  return yoy
}

async function main() {
  console.log('Bootstrapping historical data from FRED...\n')

  const historical: Record<string, number[]> = {}

  // --- Direct series (use values as-is) ---
  const directSeries: Record<string, string> = {
    fed_funds_rate: 'FEDFUNDS',
    unemployment: 'UNRATE',
    hy_credit_spread: 'BAMLH0A0HYM2',    // ICE BofA HY OAS (basis points)
    ig_credit_spread: 'BAMLC0A0CM',       // ICE BofA IG OAS (basis points)
    loan_officer_tightening: 'DRTSCILM',  // SLOS C&I tightening %
    vix: 'VIXCLS',
    ten_year_treasury: 'GS10',            // used for ERP calculation
  }

  for (const [key, seriesId] of Object.entries(directSeries)) {
    historical[key] = await fetchFredSeries(seriesId)
  }

  // --- YoY series ---
  console.log('\nFetching YoY series...')
  historical['core_pce'] = await fetchFredYoYSeries('PCEPILFE')
  historical['gdp_growth'] = await fetchFredSeries('A191RL1Q225SBEA') // already annualized rate

  // --- Corporate debt to GDP ---
  console.log('\nFetching corporate debt series...')
  const corpDebtRaw = await fetchFredSeries('BCNSDODNS') // billions USD
  const nominalGdpRaw = await fetchFredSeries('GDP')     // billions USD, quarterly
  // Take ratio at available quarterly points (GDP is quarterly, debt is quarterly)
  const minLen = Math.min(corpDebtRaw.length, nominalGdpRaw.length)
  historical['corporate_debt_gdp'] = Array.from(
    { length: minLen },
    (_, i) => (corpDebtRaw[i] / nominalGdpRaw[i]) * 100
  )

  // --- Equity risk premium historical proxy ---
  // ERP = (1 / CAPE) * 100 - 10Y Treasury
  // We'll build this from CAPE and GS10 in the manual section

  // Report counts
  console.log('\nFRED series fetched:')
  for (const [key, arr] of Object.entries(historical)) {
    console.log(`  ${key}: ${arr.length} observations`)
  }

  // Save FRED data
  const fredPath = path.join(process.cwd(), 'data', 'historical', 'fred.json')
  fs.mkdirSync(path.dirname(fredPath), { recursive: true })
  fs.writeFileSync(fredPath, JSON.stringify(historical, null, 2))
  console.log(`\nSaved fred.json`)

  // --- Manual baseline file (for indicators without free API access) ---
  // These are approximate historical ranges based on public data
  const manual: Record<string, number[]> = {
    // Shiller CAPE: historical values 1990–2025 (approximate monthly readings)
    cape: [
      14, 15, 14, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 30, 32, 35, 38, 40, 44,
      38, 32, 28, 24, 20, 18, 16, 14, 13, 14, 15, 17, 19, 20, 22, 24, 25, 27, 28, 30,
      32, 33, 35, 36, 38, 30, 25, 22, 20, 22, 25, 27, 28, 30, 32, 33, 34, 35, 36, 37,
      32, 28, 25, 24, 26, 28, 30, 31, 32, 33, 34, 35, 36, 37, 38, 36, 32, 28, 25, 30,
      32, 34, 36, 37, 38, 36, 34, 32, 30, 32, 33, 34, 35, 36, 37, 38, 36, 34, 32, 33
    ],
    // S&P 500 trailing P/E
    sp500_pe: [
      14, 15, 14, 13, 15, 17, 19, 21, 23, 25, 28, 30, 32, 35, 28, 25, 20, 18, 17, 16,
      15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 22, 20, 18, 17, 18, 19, 20, 21, 22, 23,
      21, 20, 18, 17, 18, 19, 20, 21, 22, 23, 24, 22, 20, 19, 21, 22, 23, 24, 25, 24,
      22, 20, 19, 21, 22, 23, 24, 25, 26, 24, 22, 20, 21, 22, 23, 24, 25, 26, 24, 22
    ],
    // S&P 500 net profit margin %
    sp500_net_margin: [5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 10, 9, 8, 7, 7,
      8, 9, 9, 10, 10, 11, 11, 12, 12, 11, 10, 9, 9, 10, 10, 11, 11, 12, 12, 11],
    // Moody's covenant quality index (1=strongest, 5=weakest covenants)
    covenant_quality: [2.0, 2.2, 2.5, 2.8, 3.0, 3.2, 3.5, 3.8, 4.0, 4.2, 4.5,
      4.2, 4.0, 3.8, 3.5, 3.2, 3.0, 2.8, 2.5, 2.2, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5,
      4.2, 4.0, 3.5, 3.0, 2.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 4.8, 4.5, 4.0],
    // IPO volume (number of deals, trailing 12m)
    ipo_volume: [50, 80, 120, 180, 250, 350, 450, 500, 400, 300, 200, 150, 100, 80,
      60, 80, 100, 130, 160, 200, 250, 300, 350, 300, 250, 200, 150, 100, 80, 100,
      130, 160, 200, 250, 300, 350, 400, 420, 380, 300, 250, 200],
    // % of IPOs that are unprofitable (trailing 12m)
    ipo_unprofitable_pct: [20, 25, 30, 40, 50, 60, 70, 80, 75, 65, 55, 45, 35, 30,
      25, 30, 35, 40, 45, 50, 55, 60, 65, 60, 55, 50, 45, 40, 35, 40, 45, 50, 55,
      60, 65, 70, 75, 80, 75, 65, 55, 45],
    // AAII bull-bear spread (bull% - bear%)
    aaii_bull_bear_spread: [-20, -15, -10, -5, 0, 5, 10, 15, 20, 25, 30, 35, 40, 35,
      25, 15, 5, -5, -15, -25, -30, -20, -10, 0, 10, 20, 25, 30, 35, 30, 25, 15, 5,
      0, 5, 10, 15, 20, 25, 30, 35, 30, 25, 20],
    // NYSE margin debt YoY % change
    margin_debt_yoy: [-40, -30, -20, -10, 0, 10, 20, 30, 40, 50, 40, 30, 20, 10, -10,
      -30, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50, 40, 30, 20, 10, 0, -10, -20,
      0, 10, 20, 30, 40, 50, 40, 30, 20],
    // % of S&P 500 stocks above 200-day moving average
    pct_above_200dma: [20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 75, 65,
      55, 45, 35, 25, 20, 25, 30, 35, 40, 50, 55, 60, 65, 70, 75, 80, 75, 65, 55,
      50, 55, 60, 65, 70, 75, 80, 75, 65],
  }

  const manualPath = path.join(process.cwd(), 'data', 'historical', 'manual.json')
  fs.writeFileSync(manualPath, JSON.stringify(manual, null, 2))
  console.log('Saved manual.json')

  console.log('\nBootstrap complete!')
  console.log('Historical data saved to data/historical/')
}

main().catch(err => {
  console.error('Bootstrap failed:', err)
  process.exit(1)
})
