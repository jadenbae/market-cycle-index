# Market Cycle Index — Design Document
**Date:** 2026-03-02
**Status:** Approved

---

## Purpose

An objective, emotion-free web dashboard that scores where the current market stands in the cycle — 1 (trough) to 100 (peak) — based on Howard Marks' investment philosophy as documented in his Oaktree memos (1990–2025).

Two scores are produced weekly:
- **Rule-based score**: deterministic, percentile-ranked across 19 macro indicators
- **Claude-adjusted score**: AI reasoning layer over the rule-based output, with written commentary

---

## Architecture

```
GitHub Repo
├── Next.js app (dashboard UI)
├── data/history.json (all weekly snapshots)
└── .github/workflows/weekly-update.yml

Every Monday 9am UTC:
  GitHub Actions
    → fetches 19 indicators from free APIs
    → computes rule-based score (1–100)
    → calls Claude API → adjusted score + commentary
    → appends entry to data/history.json
    → commits back to repo
    → Vercel auto-deploys
```

**Secrets** (GitHub Actions secrets, never in code):
- `ANTHROPIC_API_KEY`
- `FRED_API_KEY` (free from FRED/St. Louis Fed)

---

## Indicators

### Valuation (weight: 30%)
| # | Indicator | Source |
|---|-----------|--------|
| 1 | S&P 500 Trailing P/E | FRED / Multpl |
| 2 | CAPE / Shiller P/E | Shiller (Yale) |
| 3 | Equity Risk Premium (earnings yield − 10Y Treasury) | FRED |
| 4 | High Yield Credit Spread (OAS) | FRED (ICE BofA) |
| 5 | Investment Grade Credit Spread (OAS) | FRED (ICE BofA) |

### Macro Backdrop (weight: 20%)
| # | Indicator | Source |
|---|-----------|--------|
| 6 | US Fed Funds Rate (effective) | FRED |
| 7 | US Core PCE Inflation (YoY) | FRED |
| 8 | US GDP Growth (YoY) | FRED |
| 9 | US Unemployment Rate | FRED |
| 10 | S&P 500 Net Profit Margin | Multpl / Macro Trends |

### Credit & Leverage (weight: 20%)
| # | Indicator | Source |
|---|-----------|--------|
| 11 | Moody's Covenant Quality Index | Moody's (free) |
| 12 | US Corporate Debt-to-GDP | FRED |
| 13 | Fed Senior Loan Officer Survey — % tightening standards | FRED |

### Market Behavior & Sentiment (weight: 30%)
| # | Indicator | Source |
|---|-----------|--------|
| 14 | IPO Volume (trailing 12 months) | Renaissance Capital (free data) |
| 15 | % Unprofitable IPOs (trailing 12 months) | Renaissance Capital |
| 16 | AAII Bull/Bear Sentiment Spread | AAII (free) |
| 17 | VIX (CBOE Implied Volatility) | CBOE / FRED |
| 18 | NYSE Margin Debt (YoY change) | FINRA (free) |
| 19 | % S&P 500 stocks above 200-day MA | Barchart / Stock Charts (free) |

---

## Scoring Logic

### Rule-Based Score
1. For each indicator, compute its **percentile rank** against 20–30 years of historical data stored in the repo
2. For directional consistency, invert percentile where low value = peak risk (e.g., high yield spread: wide spread = low risk → invert)
3. Each indicator produces a **sub-score (1–100)**
4. Apply category weights and compute weighted average → **Rule-based score (1–100)**

### Claude-Adjusted Score
Claude receives:
- All 19 raw indicator values with their sub-scores
- The rule-based score
- A system prompt grounding it in Howard Marks' philosophy (pendulum, risk/return, investor psychology)

Claude outputs:
- An **adjusted score (1–100)**
- A **2–3 paragraph commentary** explaining its reasoning and any divergence from the rule-based score

---

## Dashboard UI

Single-page layout:

```
┌─────────────────────────────────────────────┐
│  Market Cycle Index          Last updated:   │
│                              Mon Mar 2, 2026 │
├────────────────┬────────────────────────────┤
│  RULE-BASED    │  CLAUDE-ADJUSTED            │
│     [ 72 ]     │       [ 68 ]                │
│  Trough──●──Peak  Trough──●──Peak            │
├────────────────┴────────────────────────────┤
│  WEEKLY COMMENTARY                           │
│  "Markets remain elevated relative to..."   │
├─────────────────────────────────────────────┤
│  TREND (past 52 weeks)                       │
│  [line chart — rule-based vs claude score]  │
├─────────────────────────────────────────────┤
│  INDICATOR BREAKDOWN                         │
│  Valuation          Sub-score    Value       │
│  ├ CAPE             85           35.4x       │
│  ├ S&P P/E          78           24.1x       │
│  └ ...                                       │
│  [categories collapsible]                   │
└─────────────────────────────────────────────┘
```

---

## Data Format

`data/history.json` — array of weekly snapshots:

```json
[
  {
    "date": "2026-03-03",
    "rule_score": 72,
    "claude_score": 68,
    "commentary": "...",
    "indicators": {
      "cape": { "value": 35.4, "sub_score": 85 },
      "sp500_pe": { "value": 24.1, "sub_score": 78 },
      "..."
    }
  }
]
```

---

## Tech Stack

- **Frontend**: Next.js (React) + Tailwind CSS
- **Hosting**: Vercel (free tier)
- **Automation**: GitHub Actions (weekly cron)
- **Data storage**: `data/history.json` in repo
- **AI**: Anthropic Claude API (Sonnet) — ~$0.02/week
- **Data sources**: All free (FRED, Shiller/Yale, AAII, CBOE, FINRA, Moody's)

---

## Cost

| Item | Cost |
|------|------|
| Vercel hosting | Free |
| GitHub Actions | Free |
| FRED API | Free |
| Claude API | ~$1/year |
| **Total** | **~$1/year** |
