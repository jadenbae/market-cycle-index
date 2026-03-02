import fs from 'fs'
import path from 'path'
import { fetchAllIndicators } from './fetch-indicators'
import { computeAllSubScores, computeRuleScore } from '../src/lib/scoring'
import { runClaudeAnalysis } from './claude-analysis'
import type { WeeklySnapshot } from '../src/lib/types'

async function main() {
  // Validate env vars early
  if (!process.env.FRED_API_KEY) {
    console.error('Missing FRED_API_KEY')
    process.exit(1)
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Missing ANTHROPIC_API_KEY')
    process.exit(1)
  }

  console.log('=== Market Cycle Index Weekly Update ===\n')

  // 1. Load historical baselines
  const fredPath = path.join(process.cwd(), 'data', 'historical', 'fred.json')
  const manualPath = path.join(process.cwd(), 'data', 'historical', 'manual.json')
  const historicalData: Record<string, number[]> = {
    ...JSON.parse(fs.readFileSync(fredPath, 'utf-8')),
    ...JSON.parse(fs.readFileSync(manualPath, 'utf-8')),
  }

  // 2. Fetch current values
  const currentValues = await fetchAllIndicators()

  // 3. Compute sub-scores
  const subScores = computeAllSubScores(currentValues, historicalData)
  console.log('\nSub-scores:')
  for (const [k, v] of Object.entries(subScores)) {
    console.log(`  ${k}: ${v}`)
  }

  // 4. Compute rule-based score
  const ruleScore = computeRuleScore(subScores)
  console.log(`\nRule-based score: ${ruleScore}/100`)

  // 5. Build indicator objects for Claude and the snapshot
  const indicators = Object.fromEntries(
    Object.entries(currentValues).map(([key, value]) => [
      key,
      { value, sub_score: subScores[key] ?? 50 }
    ])
  ) as WeeklySnapshot['indicators']

  // 6. Claude analysis
  console.log('\nCalling Claude API...')
  const { claude_score, commentary } = await runClaudeAnalysis(
    indicators as Record<string, { value: number; sub_score: number }>,
    ruleScore
  )
  console.log(`Claude score: ${claude_score}/100`)
  console.log(`Commentary preview: ${commentary.slice(0, 100)}...`)

  // 7. Build and append snapshot
  const today = new Date().toISOString().split('T')[0]
  const snapshot: WeeklySnapshot = {
    date: today,
    rule_score: ruleScore,
    claude_score,
    commentary,
    indicators,
  }

  const historyPath = path.join(process.cwd(), 'data', 'history.json')
  const history: WeeklySnapshot[] = JSON.parse(fs.readFileSync(historyPath, 'utf-8'))
  history.push(snapshot)
  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2))

  console.log(`\n✓ Snapshot written for ${today}`)
  console.log(`  Rule score: ${ruleScore} | Claude score: ${claude_score}`)
}

main().catch(err => {
  console.error('\nWeekly update failed:', err)
  process.exit(1)
})
