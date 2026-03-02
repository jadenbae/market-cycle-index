# Market Cycle Index Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Next.js web dashboard that scores current market cycle position (1–100) weekly using 19 macro indicators, a rule-based percentile scoring system, and a Claude-generated adjusted score + commentary.

**Architecture:** GitHub Actions runs every Monday, fetches 19 indicators from free APIs, computes a weighted percentile-based rule score, calls Claude API for adjusted score + commentary, appends to `data/history.json`, and commits back to the repo. Vercel auto-deploys on commit.

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, Vitest, Anthropic SDK, FRED API, GitHub Actions

---

## Project Structure

```
market-cycle-index/
├── .github/
│   └── workflows/
│       └── weekly-update.yml
├── data/
│   ├── history.json               # weekly snapshots (append-only)
│   └── historical/                # baseline data for percentile calc
│       ├── fred.json              # all FRED series historical data
│       ├── cape.json              # Shiller CAPE monthly
│       ├── aaii.json              # AAII sentiment history
│       └── manual.json            # manually maintained (IPO, covenant)
├── scripts/
│   ├── bootstrap-historical.ts    # one-time: fetch historical baselines
│   ├── fetch-indicators.ts        # weekly: fetch all 19 current values
│   ├── compute-score.ts           # percentile ranking + weighted avg
│   ├── claude-analysis.ts         # call Claude API
│   └── weekly-update.ts           # orchestrator (run by GitHub Actions)
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx               # main dashboard
│   ├── components/
│   │   ├── ScoreGauge.tsx
│   │   ├── TrendChart.tsx
│   │   ├── IndicatorBreakdown.tsx
│   │   └── Commentary.tsx
│   └── lib/
│       ├── types.ts               # shared TypeScript types
│       └── data.ts                # read/parse history.json
├── tests/
│   ├── compute-score.test.ts
│   └── data.test.ts
├── .env.example
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tailwind.config.ts`, `tsconfig.json`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `.env.example`
- Create: `.gitignore`

**Step 1: Initialize Next.js project**

```bash
cd /Users/jaden/Coding/Market_Cycle_Index
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"
```

When prompted: yes to TypeScript, yes to Tailwind, yes to App Router, no to `src/` directory.

After creation, move `app/` into `src/`:
```bash
mkdir -p src && mv app src/
```

**Step 2: Install dependencies**

```bash
npm install @anthropic-ai/sdk recharts
npm install --save-dev vitest @vitejs/plugin-react tsx
```

**Step 3: Configure Vitest**

Add to `package.json` scripts:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
})
```

**Step 4: Create .env.example**

```bash
ANTHROPIC_API_KEY=your_key_here
FRED_API_KEY=your_key_here
```

**Step 5: Create initial data files**

```bash
mkdir -p data/historical scripts tests src/components src/lib
echo "[]" > data/history.json
```

**Step 6: Initialize git and make first commit**

```bash
git init
git add .
git commit -m "feat: scaffold Next.js project with Tailwind and Vitest"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/lib/types.ts`

**Step 1: Write types**

Create `src/lib/types.ts`:
```typescript
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
}

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
```

**Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: define TypeScript types for indicators and snapshots"
```

---

## Task 3: Scoring Engine (TDD)

**Files:**
- Create: `src/lib/scoring.ts`
- Create: `tests/scoring.test.ts`

**Step 1: Write failing tests**

Create `tests/scoring.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { percentileRank, computeSubScore, computeRuleScore } from '../src/lib/scoring'

describe('percentileRank', () => {
  it('returns 50 for median value', () => {
    const history = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    expect(percentileRank(5, history)).toBeCloseTo(50, 0)
  })

  it('returns ~100 for max value', () => {
    const history = [1, 2, 3, 4, 5]
    expect(percentileRank(5, history)).toBeCloseTo(100, 0)
  })

  it('returns ~0 for min value', () => {
    const history = [1, 2, 3, 4, 5]
    expect(percentileRank(1, history)).toBeCloseTo(0, 0)
  })
})

describe('computeSubScore', () => {
  it('returns high score for high value when higher_is_peak', () => {
    const history = [10, 20, 30, 40, 50]
    const score = computeSubScore(50, history, 'higher_is_peak')
    expect(score).toBeGreaterThan(80)
  })

  it('returns high score for low value when lower_is_peak', () => {
    const history = [10, 20, 30, 40, 50]
    const score = computeSubScore(10, history, 'lower_is_peak')
    expect(score).toBeGreaterThan(80)
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
})
```

**Step 2: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '../src/lib/scoring'`

**Step 3: Implement scoring module**

Create `src/lib/scoring.ts`:
```typescript
import { CATEGORY_WEIGHTS, INDICATOR_CATEGORIES, INDICATOR_DIRECTION } from './types'

/**
 * Returns the percentile rank (0–100) of `value` within `history`.
 * Uses interpolation: % of historical values strictly below `value`.
 */
export function percentileRank(value: number, history: number[]): number {
  if (history.length === 0) return 50
  const sorted = [...history].sort((a, b) => a - b)
  const below = sorted.filter(v => v < value).length
  return Math.round((below / sorted.length) * 100)
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
```

**Step 4: Run tests — verify they pass**

```bash
npm test
```

Expected: PASS (3 test suites, all green)

**Step 5: Commit**

```bash
git add src/lib/scoring.ts tests/scoring.test.ts
git commit -m "feat: implement rule-based percentile scoring engine with tests"
```

---

## Task 4: Data Reader (TDD)

**Files:**
- Create: `src/lib/data.ts`
- Create: `tests/data.test.ts`

**Step 1: Write failing test**

Create `tests/data.test.ts`:
```typescript
import { describe, it, expect } from 'vitest'
import { getLatestSnapshot, getAllSnapshots } from '../src/lib/data'

describe('getLatestSnapshot', () => {
  it('returns the most recent snapshot', () => {
    const snapshots = [
      { date: '2026-02-23', rule_score: 65, claude_score: 60 },
      { date: '2026-03-02', rule_score: 72, claude_score: 68 },
    ]
    const result = getLatestSnapshot(snapshots as any)
    expect(result?.date).toBe('2026-03-02')
  })

  it('returns null for empty array', () => {
    expect(getLatestSnapshot([])).toBeNull()
  })
})

describe('getAllSnapshots', () => {
  it('returns snapshots sorted newest first', () => {
    const snapshots = [
      { date: '2026-03-02', rule_score: 72, claude_score: 68 },
      { date: '2026-02-23', rule_score: 65, claude_score: 60 },
    ]
    const result = getAllSnapshots(snapshots as any)
    expect(result[0].date).toBe('2026-03-02')
    expect(result[1].date).toBe('2026-02-23')
  })
})
```

**Step 2: Run — verify fail**

```bash
npm test
```

**Step 3: Implement**

Create `src/lib/data.ts`:
```typescript
import { WeeklySnapshot } from './types'
import historyRaw from '../../data/history.json'

export function getLatestSnapshot(snapshots: WeeklySnapshot[]): WeeklySnapshot | null {
  if (snapshots.length === 0) return null
  return [...snapshots].sort((a, b) => b.date.localeCompare(a.date))[0]
}

export function getAllSnapshots(snapshots: WeeklySnapshot[]): WeeklySnapshot[] {
  return [...snapshots].sort((a, b) => b.date.localeCompare(a.date))
}

export function loadHistory(): WeeklySnapshot[] {
  return historyRaw as WeeklySnapshot[]
}
```

Add to `tsconfig.json` `compilerOptions`:
```json
{
  "resolveJsonModule": true
}
```

**Step 4: Run — verify pass**

```bash
npm test
```

**Step 5: Commit**

```bash
git add src/lib/data.ts tests/data.test.ts tsconfig.json
git commit -m "feat: add data reader with snapshot sorting"
```

---

## Task 5: Bootstrap Historical Data

**Files:**
- Create: `scripts/bootstrap-historical.ts`
- Create: `data/historical/fred.json`
- Create: `data/historical/manual.json`

This script is run **once** to populate baseline historical data used for percentile calculations.

**Step 1: Write the bootstrap script**

Create `scripts/bootstrap-historical.ts`:
```typescript
import fs from 'fs'
import path from 'path'

const FRED_API_KEY = process.env.FRED_API_KEY!
const BASE_URL = 'https://api.stlouisfed.org/fred/series/observations'

// FRED series IDs mapped to indicator keys
const FRED_SERIES: Record<string, string> = {
  fed_funds_rate: 'FEDFUNDS',
  core_pce: 'PCEPILFE',           // Core PCE YoY — note: this is index, compute YoY
  gdp_growth: 'A191RL1Q225SBEA',  // Real GDP growth annual rate
  unemployment: 'UNRATE',
  hy_credit_spread: 'BAMLH0A0HYM2',   // ICE BofA HY OAS
  ig_credit_spread: 'BAMLC0A0CM',     // ICE BofA IG OAS
  corporate_debt_gdp: 'BCNSDODNS',    // Corporate debt (need to divide by GDP separately)
  loan_officer_tightening: 'DRTSCILM',// SLOS C&I loans tightening %
  vix: 'VIXCLS',
  ten_year_treasury: 'GS10',          // used to compute equity risk premium
}

async function fetchFredSeries(seriesId: string): Promise<{ date: string; value: number }[]> {
  const url = `${BASE_URL}?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&observation_start=1990-01-01`
  const res = await fetch(url)
  const json = await res.json()
  return json.observations
    .filter((o: any) => o.value !== '.')
    .map((o: any) => ({ date: o.date, value: parseFloat(o.value) }))
}

async function main() {
  console.log('Fetching FRED historical data...')
  const historical: Record<string, number[]> = {}

  for (const [key, seriesId] of Object.entries(FRED_SERIES)) {
    console.log(`  ${key} (${seriesId})...`)
    const data = await fetchFredSeries(seriesId)
    historical[key] = data.map(d => d.value)
  }

  // Compute equity risk premium from S&P earnings yield − 10Y Treasury
  // Using approximate S&P P/E history (from sp500_pe values) and GS10
  // For bootstrap, use FRED CAPE proxy and treasury
  // (ERP = 1/PE - GS10/100). Skip for now, computed at score time from live values.

  const outputPath = path.join(process.cwd(), 'data/historical/fred.json')
  fs.writeFileSync(outputPath, JSON.stringify(historical, null, 2))
  console.log(`Saved to ${outputPath}`)
}

main().catch(console.error)
```

**Step 2: Create manual baseline file**

Create `data/historical/manual.json`:
```json
{
  "cape": [7, 9, 10, 11, 14, 18, 20, 22, 24, 26, 28, 30, 35, 38, 44],
  "sp500_pe": [8, 10, 12, 15, 18, 20, 22, 25, 28, 30, 35, 40, 45],
  "sp500_net_margin": [4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  "covenant_quality": [2, 2.5, 3, 3.5, 4, 4.5, 5],
  "ipo_volume": [50, 100, 150, 200, 250, 300, 400, 500, 600],
  "ipo_unprofitable_pct": [10, 20, 30, 40, 50, 60, 70, 80],
  "aaii_bull_bear_spread": [-30, -20, -10, 0, 10, 20, 30, 40, 50],
  "margin_debt_yoy": [-40, -20, -10, 0, 10, 20, 30, 40, 50, 60],
  "pct_above_200dma": [10, 20, 30, 40, 50, 60, 70, 80, 90]
}
```

> **Note:** These manual baselines are approximate. Refine with actual historical data as the project matures. Moody's covenant quality runs 1–5 (lower = weaker).

**Step 3: Run bootstrap**

```bash
FRED_API_KEY=your_key npx tsx scripts/bootstrap-historical.ts
```

Expected: `data/historical/fred.json` created with arrays of historical values per indicator.

**Step 4: Commit**

```bash
git add scripts/bootstrap-historical.ts data/historical/
git commit -m "feat: bootstrap historical baseline data for percentile scoring"
```

---

## Task 6: Weekly Indicator Fetcher

**Files:**
- Create: `scripts/fetch-indicators.ts`

**Step 1: Write fetcher**

Create `scripts/fetch-indicators.ts`:
```typescript
const FRED_API_KEY = process.env.FRED_API_KEY!
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations'

async function fetchFredLatest(seriesId: string): Promise<number> {
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=1`
  const res = await fetch(url)
  const json = await res.json()
  const obs = json.observations.find((o: any) => o.value !== '.')
  return parseFloat(obs.value)
}

async function fetchFredYoY(seriesId: string): Promise<number> {
  // Fetch last 13 months and compute YoY change
  const url = `${FRED_BASE}?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&sort_order=desc&limit=13`
  const res = await fetch(url)
  const json = await res.json()
  const obs = json.observations.filter((o: any) => o.value !== '.').map((o: any) => parseFloat(o.value))
  if (obs.length < 13) return 0
  return ((obs[0] - obs[12]) / obs[12]) * 100
}

async function fetchShillerCAPE(): Promise<number> {
  // Shiller publishes monthly Excel — use a proxy endpoint
  // multpl.com is the easiest free source for current CAPE
  const res = await fetch('https://www.multpl.com/shiller-pe/table/by-month', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  const html = await res.text()
  // Extract first data row value
  const match = html.match(/<td[^>]*>[\s\S]*?(\d+\.\d+)[\s\S]*?<\/td>/)
  return match ? parseFloat(match[1]) : 35
}

async function fetchAaiiSentiment(): Promise<number> {
  // AAII publishes weekly CSV — parse bull-bear spread
  const res = await fetch('https://www.aaii.com/files/surveys/sentiment.xls', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  // AAII XLS parsing: bull% - bear% from most recent row
  // This requires xlsx parsing — return placeholder if unavailable
  // TODO: implement xlsx parsing with 'xlsx' package
  return 10 // placeholder
}

export async function fetchAllIndicators(): Promise<Record<string, number>> {
  const [
    fedFunds,
    corePceYoY,
    gdpGrowth,
    unemployment,
    hyCreditSpread,
    igCreditSpread,
    corporateDebtRaw,
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
    fetchFredLatest('DRTSCILM'),
    fetchFredLatest('VIXCLS'),
    fetchFredLatest('GS10'),
    fetchShillerCAPE(),
  ])

  // S&P P/E (trailing) — approximate from CAPE adjusted for cycle
  const sp500Pe = cape * 0.75  // rough approximation; refine with multpl.com

  // Equity risk premium = earnings yield (1/PE) - 10Y treasury
  const earningsYield = (1 / sp500Pe) * 100
  const equityRiskPremium = earningsYield - tenYearTreasury

  // Corporate debt to GDP proxy (BCNSDODNS / nominal GDP)
  const nominalGdp = await fetchFredLatest('GDP')
  const corporateDebtGdp = (corporateDebtRaw / nominalGdp) * 100

  // S&P net margin: use FRED corporate profits / GDP as proxy
  const sp500NetMargin = 11  // TODO: fetch from macrotrends

  // Sentiment data (with placeholders where scraping is complex)
  const aaiiSpread = await fetchAaiiSentiment()

  return {
    cape,
    sp500_pe: sp500Pe,
    equity_risk_premium: equityRiskPremium,
    hy_credit_spread: hyCreditSpread,
    ig_credit_spread: igCreditSpread,
    fed_funds_rate: fedFunds,
    core_pce: corePceYoY,
    gdp_growth: gdpGrowth,
    unemployment,
    sp500_net_margin: sp500NetMargin,
    covenant_quality: 3.5,         // TODO: Moody's manual update
    corporate_debt_gdp: corporateDebtGdp,
    loan_officer_tightening: loanOfficer,
    ipo_volume: 200,                // TODO: Renaissance Capital
    ipo_unprofitable_pct: 50,       // TODO: Renaissance Capital
    aaii_bull_bear_spread: aaiiSpread,
    vix,
    margin_debt_yoy: 10,            // TODO: FINRA monthly
    pct_above_200dma: 60,           // TODO: Barchart
  }
}
```

> **Note on TODOs:** Five indicators (sp500_net_margin, covenant_quality, ipo_volume, ipo_unprofitable_pct, margin_debt_yoy, pct_above_200dma) need manual values or additional scrapers. Start with reasonable placeholders and improve iteratively.

**Step 2: Commit**

```bash
git add scripts/fetch-indicators.ts
git commit -m "feat: add weekly indicator fetcher with FRED and Shiller data sources"
```

---

## Task 7: Claude Analysis Script

**Files:**
- Create: `scripts/claude-analysis.ts`

**Step 1: Write Claude integration**

Create `scripts/claude-analysis.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const MARKS_SYSTEM_PROMPT = `You are an investment analyst applying Howard Marks' market cycle framework from his Oaktree memos (1990–2025).

Marks' core principles:
- Markets move in cycles driven by investor psychology (the pendulum between greed and fear)
- At peaks: euphoria, risk ignorance, loose lending standards, high valuations, IPO mania, low spreads
- At troughs: despair, risk aversion, tight credit, low valuations, no IPO activity, wide spreads
- The goal is to assess WHERE IN THE CYCLE we are (1=trough, 100=peak), not to predict direction
- Quantitative signals matter, but so does the qualitative texture of investor behavior
- Credit conditions and sentiment are as important as valuation

You will receive 19 macro indicators with their current values and rule-based sub-scores (1–100), plus a weighted rule-based composite score.

Your task:
1. Reason through the indicators using Marks' framework
2. Output your own score (1–100) — you may deviate from the rule-based score if qualitative factors warrant it
3. Write 2–3 paragraphs of commentary explaining your assessment in Marks' language

Respond ONLY in this exact JSON format:
{
  "claude_score": <number 1-100>,
  "commentary": "<2-3 paragraphs as a single string with \\n\\n between paragraphs>"
}`

export async function runClaudeAnalysis(
  indicators: Record<string, { value: number; sub_score: number }>,
  ruleScore: number
): Promise<{ claude_score: number; commentary: string }> {
  const indicatorText = Object.entries(indicators)
    .map(([key, { value, sub_score }]) => `${key}: value=${value.toFixed(2)}, sub_score=${sub_score}`)
    .join('\n')

  const userMessage = `Current date: ${new Date().toISOString().split('T')[0]}

Rule-based composite score: ${ruleScore}/100

Indicator values and sub-scores:
${indicatorText}

Please assess where we are in the market cycle.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: MARKS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    const parsed = JSON.parse(text)
    return {
      claude_score: Math.max(1, Math.min(100, Math.round(parsed.claude_score))),
      commentary: parsed.commentary,
    }
  } catch {
    // Fallback if JSON parse fails
    return {
      claude_score: ruleScore,
      commentary: text,
    }
  }
}
```

**Step 2: Commit**

```bash
git add scripts/claude-analysis.ts
git commit -m "feat: add Claude API integration with Marks philosophy system prompt"
```

---

## Task 8: Weekly Update Orchestrator

**Files:**
- Create: `scripts/weekly-update.ts`

**Step 1: Write orchestrator**

Create `scripts/weekly-update.ts`:
```typescript
import fs from 'fs'
import path from 'path'
import { fetchAllIndicators } from './fetch-indicators'
import { computeAllSubScores, computeRuleScore } from '../src/lib/scoring'
import { runClaudeAnalysis } from './claude-analysis'
import { WeeklySnapshot } from '../src/lib/types'

async function main() {
  console.log('Starting weekly update...')

  // 1. Load historical baseline data
  const fredHistory = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/historical/fred.json'), 'utf-8')
  )
  const manualHistory = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'data/historical/manual.json'), 'utf-8')
  )
  const historicalData = { ...fredHistory, ...manualHistory }

  // 2. Fetch current indicator values
  console.log('Fetching indicators...')
  const currentValues = await fetchAllIndicators()

  // 3. Compute sub-scores
  const subScores = computeAllSubScores(currentValues, historicalData)

  // 4. Compute rule-based score
  const ruleScore = computeRuleScore(subScores)
  console.log(`Rule-based score: ${ruleScore}`)

  // 5. Build indicator objects
  const indicators = Object.fromEntries(
    Object.entries(currentValues).map(([key, value]) => [
      key,
      { value, sub_score: subScores[key] ?? 50 }
    ])
  )

  // 6. Call Claude
  console.log('Calling Claude API...')
  const { claude_score, commentary } = await runClaudeAnalysis(indicators, ruleScore)
  console.log(`Claude score: ${claude_score}`)

  // 7. Build snapshot
  const today = new Date().toISOString().split('T')[0]
  const snapshot: WeeklySnapshot = {
    date: today,
    rule_score: ruleScore,
    claude_score,
    commentary,
    indicators: indicators as WeeklySnapshot['indicators'],
  }

  // 8. Append to history.json
  const historyPath = path.join(process.cwd(), 'data/history.json')
  const history: WeeklySnapshot[] = JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
  history.push(snapshot)
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2))

  console.log(`Done. Snapshot written for ${today}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

**Step 2: Test run locally**

```bash
FRED_API_KEY=your_key ANTHROPIC_API_KEY=your_key npx tsx scripts/weekly-update.ts
```

Expected: `data/history.json` now contains one entry with all scores and commentary.

**Step 3: Commit**

```bash
git add scripts/weekly-update.ts data/history.json
git commit -m "feat: add weekly update orchestrator script"
```

---

## Task 9: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/weekly-update.yml`

**Step 1: Write workflow**

Create `.github/workflows/weekly-update.yml`:
```yaml
name: Weekly Market Cycle Update

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 9am UTC
  workflow_dispatch:      # Allow manual trigger from GitHub UI

jobs:
  update:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout repo
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run weekly update
        env:
          FRED_API_KEY: ${{ secrets.FRED_API_KEY }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        run: npx tsx scripts/weekly-update.ts

      - name: Commit updated history
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add data/history.json
          git diff --staged --quiet || git commit -m "data: weekly update $(date +%Y-%m-%d)"
          git push
```

**Step 2: Add secrets to GitHub**

In the GitHub repo → Settings → Secrets and variables → Actions, add:
- `FRED_API_KEY` — from https://fred.stlouisfed.org/docs/api/api_key.html (free)
- `ANTHROPIC_API_KEY` — from https://console.anthropic.com

**Step 3: Commit workflow**

```bash
git add .github/
git commit -m "feat: add GitHub Actions weekly update workflow"
```

---

## Task 10: Dashboard Components

**Files:**
- Create: `src/components/ScoreGauge.tsx`
- Create: `src/components/TrendChart.tsx`
- Create: `src/components/IndicatorBreakdown.tsx`
- Create: `src/components/Commentary.tsx`

**Step 1: ScoreGauge component**

Create `src/components/ScoreGauge.tsx`:
```tsx
interface Props {
  score: number
  label: string
}

export function ScoreGauge({ score, label }: Props) {
  const color = score > 70 ? '#ef4444' : score > 40 ? '#f59e0b' : '#22c55e'

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <div
        className="flex items-center justify-center w-32 h-32 rounded-full border-8"
        style={{ borderColor: color }}
      >
        <span className="text-4xl font-bold" style={{ color }}>{score}</span>
      </div>
      <div className="w-full max-w-48 flex justify-between text-xs text-gray-400">
        <span>Trough (1)</span>
        <span>Peak (100)</span>
      </div>
      <div className="w-full max-w-48 h-2 bg-gray-200 rounded-full relative">
        <div
          className="absolute top-0 h-2 rounded-full"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
```

**Step 2: TrendChart component**

Create `src/components/TrendChart.tsx`:
```tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts'
import { WeeklySnapshot } from '@/lib/types'

interface Props {
  snapshots: WeeklySnapshot[]
}

export function TrendChart({ snapshots }: Props) {
  const data = [...snapshots]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-52)  // last 52 weeks
    .map(s => ({
      date: s.date.slice(5),  // MM-DD
      'Rule Score': s.rule_score,
      'Claude Score': s.claude_score,
    }))

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend />
          <ReferenceLine y={50} stroke="#9ca3af" strokeDasharray="4 4" />
          <Line type="monotone" dataKey="Rule Score" stroke="#6366f1" dot={false} strokeWidth={2} />
          <Line type="monotone" dataKey="Claude Score" stroke="#f59e0b" dot={false} strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
```

**Step 3: IndicatorBreakdown component**

Create `src/components/IndicatorBreakdown.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { WeeklySnapshot, INDICATOR_CATEGORIES } from '@/lib/types'

const CATEGORY_LABELS: Record<string, string> = {
  valuation: 'Valuation',
  macro: 'Macro Backdrop',
  credit: 'Credit & Leverage',
  sentiment: 'Market Sentiment & Behavior',
}

const INDICATOR_LABELS: Record<string, string> = {
  cape: 'CAPE / Shiller P/E',
  sp500_pe: 'S&P 500 Trailing P/E',
  equity_risk_premium: 'Equity Risk Premium (%)',
  hy_credit_spread: 'High Yield Spread (bps)',
  ig_credit_spread: 'Investment Grade Spread (bps)',
  fed_funds_rate: 'Fed Funds Rate (%)',
  core_pce: 'Core PCE Inflation (YoY %)',
  gdp_growth: 'GDP Growth (YoY %)',
  unemployment: 'Unemployment Rate (%)',
  sp500_net_margin: 'S&P 500 Net Profit Margin (%)',
  covenant_quality: 'Covenant Quality Index (Moody\'s)',
  corporate_debt_gdp: 'Corporate Debt / GDP (%)',
  loan_officer_tightening: 'Loan Officer Tightening (%)',
  ipo_volume: 'IPO Volume (trailing 12m)',
  ipo_unprofitable_pct: 'Unprofitable IPOs (%)',
  aaii_bull_bear_spread: 'AAII Bull-Bear Spread (%)',
  vix: 'VIX',
  margin_debt_yoy: 'NYSE Margin Debt (YoY %)',
  pct_above_200dma: 'S&P 500 Stocks Above 200-DMA (%)',
}

function scoreColor(score: number) {
  if (score > 70) return 'text-red-500'
  if (score > 40) return 'text-amber-500'
  return 'text-green-500'
}

interface Props {
  snapshot: WeeklySnapshot
}

export function IndicatorBreakdown({ snapshot }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ valuation: true })

  return (
    <div className="space-y-2">
      {Object.entries(INDICATOR_CATEGORIES).map(([category, keys]) => (
        <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpanded(e => ({ ...e, [category]: !e[category] }))}
            className="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100 text-sm font-medium"
          >
            <span>{CATEGORY_LABELS[category]}</span>
            <span>{expanded[category] ? '▲' : '▼'}</span>
          </button>
          {expanded[category] && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left px-4 py-2">Indicator</th>
                  <th className="text-right px-4 py-2">Value</th>
                  <th className="text-right px-4 py-2">Sub-Score</th>
                </tr>
              </thead>
              <tbody>
                {keys.map(key => {
                  const ind = snapshot.indicators[key as keyof typeof snapshot.indicators]
                  return (
                    <tr key={key} className="border-b last:border-0">
                      <td className="px-4 py-2 text-gray-700">{INDICATOR_LABELS[key] ?? key}</td>
                      <td className="px-4 py-2 text-right font-mono">{ind?.value?.toFixed(2) ?? '—'}</td>
                      <td className={`px-4 py-2 text-right font-bold ${scoreColor(ind?.sub_score ?? 50)}`}>
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
```

**Step 4: Commentary component**

Create `src/components/Commentary.tsx`:
```tsx
interface Props {
  commentary: string
  date: string
}

export function Commentary({ commentary, date }: Props) {
  const paragraphs = commentary.split('\n\n')
  return (
    <div className="prose prose-sm max-w-none">
      <p className="text-xs text-gray-400 mb-3">Week of {date}</p>
      {paragraphs.map((p, i) => (
        <p key={i} className="text-gray-700 leading-relaxed mb-3">{p}</p>
      ))}
    </div>
  )
}
```

**Step 5: Commit**

```bash
git add src/components/
git commit -m "feat: add dashboard UI components (gauge, chart, breakdown, commentary)"
```

---

## Task 11: Main Dashboard Page

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/layout.tsx`

**Step 1: Update layout**

Replace `src/app/layout.tsx`:
```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Market Cycle Index',
  description: 'Objective market cycle positioning based on Howard Marks\' framework',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>{children}</body>
    </html>
  )
}
```

**Step 2: Build main page**

Replace `src/app/page.tsx`:
```tsx
import { loadHistory, getLatestSnapshot, getAllSnapshots } from '@/lib/data'
import { ScoreGauge } from '@/components/ScoreGauge'
import { TrendChart } from '@/components/TrendChart'
import { IndicatorBreakdown } from '@/components/IndicatorBreakdown'
import { Commentary } from '@/components/Commentary'

export default function Page() {
  const history = loadHistory()
  const latest = getLatestSnapshot(history)
  const all = getAllSnapshots(history)

  if (!latest) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-12 text-center text-gray-500">
        No data yet. Run the weekly update script to populate the first snapshot.
      </main>
    )
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex justify-between items-baseline">
        <h1 className="text-2xl font-bold text-gray-900">Market Cycle Index</h1>
        <p className="text-sm text-gray-400">Last updated: {latest.date}</p>
      </div>

      {/* Scores */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex justify-around">
          <ScoreGauge score={latest.rule_score} label="Rule-Based" />
          <div className="w-px bg-gray-200" />
          <ScoreGauge score={latest.claude_score} label="Claude-Adjusted" />
        </div>
      </section>

      {/* Commentary */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
          Weekly Commentary
        </h2>
        <Commentary commentary={latest.commentary} date={latest.date} />
      </section>

      {/* Trend Chart */}
      {all.length > 1 && (
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
            Trend (Past 52 Weeks)
          </h2>
          <TrendChart snapshots={all} />
        </section>
      )}

      {/* Indicator Breakdown */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
          Indicator Breakdown
        </h2>
        <IndicatorBreakdown snapshot={latest} />
      </section>
    </main>
  )
}
```

**Step 3: Verify it builds**

```bash
npm run build
```

Expected: successful build with no errors.

**Step 4: Run dev server and verify UI**

```bash
npm run dev
```

Open http://localhost:3000 — should show either the dashboard (if history.json has data) or the empty state message.

**Step 5: Commit**

```bash
git add src/app/
git commit -m "feat: build main dashboard page assembling all components"
```

---

## Task 12: Deploy to Vercel

**Step 1: Push to GitHub**

```bash
git remote add origin https://github.com/<your-username>/market-cycle-index.git
git push -u origin main
```

**Step 2: Connect to Vercel**

1. Go to https://vercel.com/new
2. Import the GitHub repo
3. Framework: Next.js (auto-detected)
4. No environment variables needed for the frontend (API keys are only used in GitHub Actions)
5. Deploy

**Step 3: Add GitHub secrets**

In GitHub repo → Settings → Secrets → Actions:
- `FRED_API_KEY`
- `ANTHROPIC_API_KEY`

**Step 4: Trigger first manual run**

In GitHub → Actions → Weekly Market Cycle Update → Run workflow

Verify:
- Job completes without errors
- `data/history.json` gains one entry
- Vercel auto-deploys
- Dashboard shows scores and commentary

**Step 5: Final commit with any fixes**

```bash
git add .
git commit -m "chore: post-deploy fixes and config"
git push
```

---

## Free API Key Setup

| Service | URL | Notes |
|---------|-----|-------|
| FRED API | https://fred.stlouisfed.org/docs/api/api_key.html | Instant, free |
| Anthropic | https://console.anthropic.com | ~$1/year at this usage |

---

## Known Limitations (v1)

Five indicators use placeholder values and need iterative improvement:
- `sp500_net_margin` — use macrotrends.net scraper
- `covenant_quality` — update manually from Moody's monthly PDF
- `ipo_volume` / `ipo_unprofitable_pct` — scrape Renaissance Capital
- `margin_debt_yoy` — parse FINRA monthly CSV
- `pct_above_200dma` — use Barchart or compute via Yahoo Finance batch

These can be addressed in v2 without changing the scoring architecture.
