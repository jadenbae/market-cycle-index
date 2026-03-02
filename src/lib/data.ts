import { WeeklySnapshot } from './types'

export function getLatestSnapshot(snapshots: WeeklySnapshot[]): WeeklySnapshot | null {
  if (snapshots.length === 0) return null
  return [...snapshots].sort((a, b) => b.date.localeCompare(a.date))[0]
}

export function getAllSnapshots(snapshots: WeeklySnapshot[]): WeeklySnapshot[] {
  return [...snapshots].sort((a, b) => b.date.localeCompare(a.date))
}

export function loadHistory(): WeeklySnapshot[] {
  // Dynamic require to avoid issues with Next.js static analysis
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require('../../data/history.json')
  return raw as WeeklySnapshot[]
}
