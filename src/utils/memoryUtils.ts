import type { MemorySnapshot } from '../types'

const snapshotHistory: MemorySnapshot[] = []

export function getMemoryInfo(label = ''): MemorySnapshot {
  const mem = (performance as any).memory
  return {
    heapUsed: mem?.usedJSHeapSize ?? 0,
    heapTotal: mem?.totalJSHeapSize ?? 0,
    heapLimit: mem?.jsHeapSizeLimit ?? 0,
    domCount: document.querySelectorAll('*').length,
    timestamp: Date.now(),
    label,
  }
}

export function takeSnapshot(label: string): MemorySnapshot {
  const snap = getMemoryInfo(label)
  snapshotHistory.push(snap)
  console.log(
    `%c[快照] ${label}: Heap=${formatBytes(snap.heapUsed)}, DOM=${snap.domCount}`,
    'color: #409EFF'
  )
  return snap
}

export function getSnapshotHistory(): MemorySnapshot[] {
  return [...snapshotHistory]
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const idx = Math.min(i, units.length - 1)
  return parseFloat((bytes / Math.pow(k, idx)).toFixed(2)) + ' ' + units[idx]
}

export function calculateDelta(a: MemorySnapshot, b: MemorySnapshot): string {
  const heapDelta = b.heapUsed - a.heapUsed
  const domDelta = b.domCount - a.domCount
  const sign = heapDelta >= 0 ? '+' : ''
  return `Heap: ${sign}${formatBytes(Math.abs(heapDelta))}, DOM: ${domDelta >= 0 ? '+' : ''}${domDelta}`
}
