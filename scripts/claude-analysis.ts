import Anthropic from '@anthropic-ai/sdk'

const MARKS_SYSTEM_PROMPT = `You are an investment analyst applying Howard Marks' market cycle framework from his Oaktree memos (1990–2025).

Marks' core principles for assessing where we are in the cycle:
- Markets move in cycles driven by investor psychology — the pendulum swings between greed and fear
- At peaks (score near 100): euphoria, risk ignorance, loose lending standards, stretched valuations, IPO mania, tight credit spreads, high leverage, low VIX
- At troughs (score near 1): despair, extreme risk aversion, tight credit, depressed valuations, no IPO activity, wide credit spreads, forced deleveraging, high VIX
- Quantitative signals matter, but so does the qualitative texture of investor behavior
- Credit conditions and sentiment are as important as valuation — sometimes more so
- "The less prudence with which others conduct their affairs, the greater prudence with which we should conduct our own" — Buffett (Marks' favorite quote)

You will receive 19 macro indicators with their current values and rule-based sub-scores (1–100, where 100 = peak territory). You will also receive the weighted composite rule-based score.

Your task:
1. Reason through the indicators using Marks' framework — which tell the most important story right now?
2. Output your own score (1–100) — deviate from the rule-based score if qualitative factors or cross-indicator patterns warrant it
3. Write 2–3 paragraphs of commentary in plain English, using Marks' language and analogies (pendulum, temperature, etc.)

Respond ONLY in this exact JSON format:
{
  "claude_score": <integer 1-100>,
  "commentary": "<2-3 paragraphs separated by \\n\\n>"
}`

export async function runClaudeAnalysis(
  indicators: Record<string, { value: number; sub_score: number }>,
  ruleScore: number
): Promise<{ claude_score: number; commentary: string }> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const indicatorLines = Object.entries(indicators)
    .map(([key, { value, sub_score }]) =>
      `  ${key}: current=${value.toFixed(2)}, sub_score=${sub_score}/100`
    )
    .join('\n')

  const userMessage = `Date: ${new Date().toISOString().split('T')[0]}
Rule-based composite score: ${ruleScore}/100

Current indicator values and sub-scores:
${indicatorLines}

Please assess where we are in the market cycle.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: MARKS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  try {
    // Extract JSON from response (handle potential markdown code fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON found in response')
    const parsed = JSON.parse(jsonMatch[0]) as { claude_score: number; commentary: string }
    return {
      claude_score: Math.max(1, Math.min(100, Math.round(parsed.claude_score))),
      commentary: parsed.commentary,
    }
  } catch (err) {
    console.warn('Failed to parse Claude response as JSON, using fallback:', err)
    return {
      claude_score: ruleScore,
      commentary: text.slice(0, 1000),
    }
  }
}
