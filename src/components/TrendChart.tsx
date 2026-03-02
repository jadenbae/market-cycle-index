'use client'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, Legend,
  ResponsiveContainer, ReferenceLine, CartesianGrid
} from 'recharts'
import type { WeeklySnapshot } from '@/lib/types'

interface Props {
  snapshots: WeeklySnapshot[]
}

export function TrendChart({ snapshots }: Props) {
  const data = [...snapshots]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-52)
    .map(s => ({
      date: s.date.slice(5),
      'Rule': s.rule_score,
      'Claude': s.claude_score,
    }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
        <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(value: number | undefined, name: string | undefined) => [`${value ?? '—'}`, name ?? '']}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
        <ReferenceLine y={50} stroke="#d1d5db" strokeDasharray="4 4" label={{ value: 'Mid', position: 'right', fontSize: 10, fill: '#9ca3af' }} />
        <Line type="monotone" dataKey="Rule" stroke="#6366f1" dot={false} strokeWidth={2} />
        <Line type="monotone" dataKey="Claude" stroke="#f59e0b" dot={false} strokeWidth={2} strokeDasharray="5 3" />
      </LineChart>
    </ResponsiveContainer>
  )
}
