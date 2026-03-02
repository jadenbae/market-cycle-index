# Market Cycle Index — Project Context

## Purpose

A web dashboard that scores where the current market sits in the cycle on a scale of **1 (trough) to 100 (peak)**, updated weekly from free data sources. Based on Howard Marks' investment philosophy as documented in his Oaktree memos (1990–2025).

The two source PDFs are in the project root:
- `the-complete-collection.pdf` — all Marks memos 1990–2025 (1641 pages)
- `ai-hurtles-ahead.pdf` — recent AI-focused memo

Core philosophy: cycles are driven by investor psychology (the pendulum between greed and fear). At peaks: euphoria, loose credit, high valuations, IPO mania. At troughs: despair, tight credit, low valuations, no deal activity.

---

## Architecture

```
GitHub Repo
├── Next.js dashboard (frontend)
├── data/history.json          ← append-only weekly snapshots
├── data/historical/           ← baseline data for percentile calc
└── .github/workflows/weekly-update.yml

Every Monday 9am UTC:
  GitHub Actions → fetch 19 indicators → compute rule score
  → call Claude API → append to history.json → commit → Vercel auto-deploys
```

---

## Tech Stack

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts
- **Automation**: GitHub Actions (weekly cron)
- **AI**: Anthropic Claude API (Sonnet) — `@anthropic-ai/sdk`
- **Data storage**: `data/history.json` (flat JSON array, no database)
- **Hosting**: Vercel
- **Testing**: Vitest
- **Scripts**: TypeScript via `tsx`

---

## Key File Paths

| Path | Purpose |
|------|---------|
| `data/history.json` | All weekly snapshots (append-only) |
| `data/historical/fred.json` | Historical FRED series for percentile calc |
| `data/historical/manual.json` | Manually maintained historical baselines |
| `src/lib/types.ts` | All TypeScript types + category weights + indicator direction |
| `src/lib/scoring.ts` | Percentile ranking + weighted score computation |
| `src/lib/data.ts` | Reads and sorts history.json |
| `scripts/fetch-indicators.ts` | Fetches all 19 current indicator values |
| `scripts/claude-analysis.ts` | Calls Claude API, returns adjusted score + commentary |
| `scripts/weekly-update.ts` | Orchestrator: fetch → score → Claude → write → done |
| `scripts/bootstrap-historical.ts` | One-time script to populate historical baselines |
| `.github/workflows/weekly-update.yml` | GitHub Actions weekly cron |
| `docs/plans/` | Design doc and implementation plan |

---

## The Two Scores

Every weekly snapshot contains two scores:

1. **Rule-based score** — deterministic. Each of the 19 indicators is percentile-ranked against historical data. Sub-scores are weighted by category and averaged. No AI involved.

2. **Claude-adjusted score** — Claude receives all 19 raw values + sub-scores + the rule-based score, reasons through them using Marks' framework, and outputs its own score + 2–3 paragraph commentary.

Both scores are displayed side by side on the dashboard.

---

## The 19 Indicators

### Valuation (30% weight)
| Key | Description | Direction |
|-----|-------------|-----------|
| `cape` | CAPE / Shiller P/E | higher = peak |
| `sp500_pe` | S&P 500 trailing P/E | higher = peak |
| `equity_risk_premium` | Earnings yield − 10Y Treasury | lower = peak |
| `hy_credit_spread` | High yield OAS (bps) | lower = peak |
| `ig_credit_spread` | Investment grade OAS (bps) | lower = peak |

### Macro Backdrop (20% weight)
| Key | Description | Direction |
|-----|-------------|-----------|
| `fed_funds_rate` | Effective Fed funds rate | higher = peak |
| `core_pce` | Core PCE YoY % | higher = peak |
| `gdp_growth` | Real GDP growth YoY % | higher = peak |
| `unemployment` | US unemployment rate | lower = peak |
| `sp500_net_margin` | S&P 500 net profit margin % | higher = peak |

### Credit & Leverage (20% weight)
| Key | Description | Direction |
|-----|-------------|-----------|
| `covenant_quality` | Moody's covenant quality index | lower = peak |
| `corporate_debt_gdp` | Corporate debt / GDP % | higher = peak |
| `loan_officer_tightening` | Fed SLOS % tightening C&I standards | lower = peak |

### Market Behavior & Sentiment (30% weight)
| Key | Description | Direction |
|-----|-------------|-----------|
| `ipo_volume` | IPO count trailing 12m | higher = peak |
| `ipo_unprofitable_pct` | % unprofitable IPOs trailing 12m | higher = peak |
| `aaii_bull_bear_spread` | AAII bull% − bear% | higher = peak |
| `vix` | CBOE VIX | lower = peak |
| `margin_debt_yoy` | NYSE margin debt YoY % change | higher = peak |
| `pct_above_200dma` | % S&P 500 stocks above 200-day MA | higher = peak |

---

## Data Sources (all free)

| Source | Indicators | API Key |
|--------|-----------|---------|
| FRED (St. Louis Fed) | Fed funds, PCE, GDP, unemployment, HY spread, IG spread, corporate debt, SLOS, VIX, 10Y treasury | Yes — free at fred.stlouisfed.org |
| Shiller/Yale (multpl.com) | CAPE, S&P P/E | No |
| AAII | Bull/bear sentiment | No (CSV download) |
| FINRA | NYSE margin debt | No (monthly CSV) |
| Moody's | Covenant quality | Manual update from monthly PDF |
| Renaissance Capital | IPO volume, % unprofitable | Manual or scrape |
| Barchart / StockCharts | % above 200-DMA | No |

---

## Secrets (GitHub Actions)

Never hardcode these. Stored as GitHub Actions secrets:
- `ANTHROPIC_API_KEY`
- `FRED_API_KEY`

---

## Scoring Rules

- Sub-scores range 1–100 where **100 = peak territory, 1 = trough territory**
- Percentile rank is computed against `data/historical/` baseline arrays
- `INDICATOR_DIRECTION` in `src/lib/types.ts` controls whether high or low value maps to peak
- Category weights: valuation 30%, macro 20%, credit 20%, sentiment 30%
- Rule score = weighted average of category averages, rounded to integer

---

## Known v1 Limitations

Five indicators use placeholder values pending better data sources:
- `sp500_net_margin` — hardcoded ~11%
- `covenant_quality` — hardcoded ~3.5 (manual update needed)
- `ipo_volume` / `ipo_unprofitable_pct` — hardcoded placeholders
- `margin_debt_yoy` — hardcoded placeholder
- `pct_above_200dma` — hardcoded placeholder

These can be improved in v2 without changing the scoring architecture.

---

## Development Commands

```bash
npm run dev        # start local dev server
npm run build      # production build
npm test           # run Vitest tests
npx tsx scripts/weekly-update.ts   # run weekly update locally (needs env vars)
npx tsx scripts/bootstrap-historical.ts  # one-time historical data fetch
```

---

## Implementation Plan

Full step-by-step plan at:
`docs/plans/2026-03-02-market-cycle-index-implementation.md`

Design document at:
`docs/plans/2026-03-02-market-cycle-index-design.md`
