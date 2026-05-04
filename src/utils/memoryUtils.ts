import type { MemorySnapshot } from '../types'

const snapshotHistory: MemorySnapshot[] = []

/** 模糊当前焦点元素，关闭所有打开的下来框/弹出层 */
export function blurActiveElement(): void {
  const el = document.activeElement
  if (el && el instanceof HTMLElement) {
    el.blur()
  }
}

/** 强制清理 Element Plus 和 Naive UI 产生的游离 DOM（popper/overlay 等） */
export function cleanOrphanedDOM(): void {
  // Element Plus 游离元素
  const elSelectors = [
    '.el-popper',
    '.el-select-dropdown',
    '.el-overlay',
    '.el-tooltip__popper',
    '.el-dropdown__popper',
    '.el-picker__popper',
    '.el-popover',
    '.el-message-box__wrapper',
    '.el-dialog__wrapper',
    '.el-drawer__wrapper',
    '.el-cascader__dropdown',
    '.el-autocomplete__dropdown',
    '.el-color-dropdown',
    '.el-time-panel',
    '.el-date-picker',
    '.el-image-viewer__wrapper',
  ]
  elSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => el.remove())
  })

  // Naive UI 游离元素
  const naiveSelectors = [
    '.n-base-select-menu',
    '.n-popover',
    '.n-tooltip',
    '.n-dropdown-menu',
    '.n-date-panel',
    '.n-time-picker-panel',
    '.n-color-picker-panel',
    '.n-modal-container',
    '.n-drawer-container',
    '.n-message-container',
    '.n-notification-container',
  ]
  naiveSelectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => el.remove())
  })

  // 清理 v-binder 跟随容器 (Naive UI)
  const followers = document.querySelectorAll('.v-binder-follower-container > .v-binder-follower-content')
  followers.forEach((el) => {
    if (el.children.length === 0) {
      el.parentElement?.remove()
    }
  })
}

/** 销毁表单前的综合清理 */
export function preDestroyCleanup(): void {
  blurActiveElement()
}

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
