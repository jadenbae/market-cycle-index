import fs from 'fs'
import path from 'path'
import { WeeklySnapshot } from './types'

export function getLatestSnapshot(snapshots: WeeklySnapshot[]): WeeklySnapshot | null {
  if (snapshots.length === 0) return null
  return [...snapshots].sort((a, b) => b.date.localeCompare(a.date))[0]
}

export function getAllSnapshots(snapshots: WeeklySnapshot[]): WeeklySnapshot[] {
  return [...snapshots].sort((a, b) => b.date.localeCompare(a.date))
}

export function loadHistory(): WeeklySnapshot[] {
  const filePath = path.join(process.cwd(), 'data', 'history.json')
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw) as WeeklySnapshot[]
}
