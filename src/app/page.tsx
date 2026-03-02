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
      <main className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Market Cycle Index</h1>
        <p className="text-gray-500">
          No data yet. Trigger the GitHub Actions workflow to generate the first weekly snapshot.
        </p>
      </main>
    )
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Market Cycle Index</h1>
        <p className="text-xs text-gray-400">Updated {latest.date}</p>
      </div>

      {/* Score gauges */}
      <section className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="flex items-center justify-around gap-8">
          <ScoreGauge score={latest.rule_score} label="Rule-Based Score" />
          <div className="hidden sm:block w-px h-32 bg-gray-200" />
          <ScoreGauge score={latest.claude_score} label="Claude-Adjusted Score" />
        </div>
      </section>

      {/* Commentary */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Weekly Commentary
        </h2>
        <Commentary commentary={latest.commentary} date={latest.date} />
      </section>

      {/* Trend chart — only show when we have more than 1 week of data */}
      {all.length > 1 && (
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
            Score Trend (up to 52 weeks)
          </h2>
          <TrendChart snapshots={all} />
        </section>
      )}

      {/* Indicator breakdown */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4">
          Indicator Breakdown
        </h2>
        <IndicatorBreakdown snapshot={latest} />
      </section>
    </main>
  )
}
