import { describe, it, expect } from 'vitest'
import { getLatestSnapshot, getAllSnapshots } from '../src/lib/data'
import type { WeeklySnapshot } from '../src/lib/types'

// Minimal snapshot factory for testing (only fields needed by these functions)
function makeSnapshot(date: string, rule_score: number, claude_score: number): WeeklySnapshot {
  return {
    date,
    rule_score,
    claude_score,
    commentary: '',
    indicators: {} as WeeklySnapshot['indicators'],
  }
}

describe('getLatestSnapshot', () => {
  it('returns the most recent snapshot by date', () => {
    const snapshots = [
      makeSnapshot('2026-02-23', 65, 60),
      makeSnapshot('2026-03-02', 72, 68),
    ]
    const result = getLatestSnapshot(snapshots)
    expect(result?.date).toBe('2026-03-02')
  })

  it('returns null for empty array', () => {
    expect(getLatestSnapshot([])).toBeNull()
  })

  it('works with a single snapshot', () => {
    const snapshots = [makeSnapshot('2026-01-01', 50, 50)]
    expect(getLatestSnapshot(snapshots)?.date).toBe('2026-01-01')
  })
})

describe('getAllSnapshots', () => {
  it('returns snapshots sorted newest first', () => {
    const snapshots = [
      makeSnapshot('2026-03-02', 72, 68),
      makeSnapshot('2026-02-23', 65, 60),
      makeSnapshot('2026-02-16', 60, 58),
    ]
    const result = getAllSnapshots(snapshots)
    expect(result[0].date).toBe('2026-03-02')
    expect(result[1].date).toBe('2026-02-23')
    expect(result[2].date).toBe('2026-02-16')
  })

  it('does not mutate the input array', () => {
    const snapshots = [
      makeSnapshot('2026-02-23', 65, 60),
      makeSnapshot('2026-03-02', 72, 68),
    ]
    const original = [...snapshots]
    getAllSnapshots(snapshots)
    expect(snapshots[0].date).toBe(original[0].date)
  })

  it('returns empty array for empty input', () => {
    expect(getAllSnapshots([])).toEqual([])
  })
})
