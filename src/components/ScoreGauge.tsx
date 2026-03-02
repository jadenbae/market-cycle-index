interface Props {
  score: number
  label: string
}

export function ScoreGauge({ score, label }: Props) {
  const color = score > 70 ? '#ef4444' : score > 40 ? '#f59e0b' : '#22c55e'

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest">{label}</p>
      <div
        className="flex items-center justify-center w-36 h-36 rounded-full border-8"
        style={{ borderColor: color }}
      >
        <span className="text-5xl font-bold tabular-nums" style={{ color }}>{score}</span>
      </div>
      <div className="w-48 space-y-1">
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${score}%`, backgroundColor: color }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400">
          <span>Trough (1)</span>
          <span>Peak (100)</span>
        </div>
      </div>
    </div>
  )
}
