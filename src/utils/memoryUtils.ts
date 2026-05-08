import type { MemorySnapshot } from '../types'

const snapshotHistory: MemorySnapshot[] = []

/** 将焦点重定向到页面外的一个持久元素，避免 Chromium 持有已销毁元素的焦点引用 */
export function redirectFocus(): void {
  const el = document.activeElement
  if (!el || !(el instanceof HTMLElement)) return

  // 如果焦点已经在 sink 上或者不在表单内，跳过
  if (el.id === 'focus-sink') return

  let sink = document.getElementById('focus-sink') as HTMLInputElement | null
  if (!sink) {
    sink = document.createElement('input')
    sink.id = 'focus-sink'
    sink.type = 'text'
    sink.tabIndex = -1
    sink.setAttribute('aria-hidden', 'true')
    Object.assign(sink.style, {
      position: 'fixed', top: '-9999px', left: '-9999px',
      width: '1px', height: '1px', opacity: '0', pointerEvents: 'none',
    })
    document.body.appendChild(sink)
  }
  sink.focus()
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

  // Naive UI LazyTeleport 持久容器 — 创建后永不自行销毁，销毁时无条件移除
  document.querySelectorAll('.v-binder-follower-container').forEach((el) => el.remove())
}

/** 销毁表单前的综合清理：blur + 删除浮层 + rAF 延迟二次清扫 */
export function preDestroyCleanup(): void {
  // 焦点重定向到持久元素：避免 Chromium 在表单销毁时持有已移除元素的焦点引用
  redirectFocus()

  // 立即删除 Element Plus 浮层（不隐藏，直接移除）
  document.querySelectorAll('.el-select-dropdown').forEach((el) => el.remove())
  document.querySelectorAll('.el-popper.is-light').forEach((el) => el.remove())

  // 立即删除 Naive UI 浮层
  document.querySelectorAll('.n-base-select-menu').forEach((el) => el.remove())

  // rAF 延迟二次清扫：给浏览器一帧时间处理 blur 事件释放焦点引用
  requestAnimationFrame(() => {
    cleanOrphanedDOM()
  })
}

/** 扫描 #app 内元素，按标签+类名分组统计 */
export function scanAppElements(label: string): Record<string, number> {
  const app = document.getElementById('app')
  if (!app) return {}
  const tagCounts: Record<string, number> = {}
  const all = app.querySelectorAll('*')
  all.forEach((el) => {
    const tag = el.tagName.toLowerCase()
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.')
      : ''
    const id = el.id ? '#' + el.id : ''
    const key = `${tag}${id}${cls}`
    tagCounts[key] = (tagCounts[key] || 0) + 1
  })
  const total = Object.values(tagCounts).reduce((a, b) => a + b, 0)
  console.log(`%c[#app扫描] ${label}: ${total} 个元素`, 'color: #E6A23C', tagCounts)
  return tagCounts
}

/** 记录 #app 内元素基准（初始化时调用） */
let appBaseline: Record<string, number> = {}
export function captureAppBaseline(): void {
  const app = document.getElementById('app')
  if (!app) return
  appBaseline = {}
  app.querySelectorAll('*').forEach((el) => {
    const tag = el.tagName.toLowerCase()
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.split(' ').filter(Boolean).slice(0, 2).join('.')
      : ''
    const id = el.id ? '#' + el.id : ''
    const key = `${tag}${id}${cls}`
    appBaseline[key] = (appBaseline[key] || 0) + 1
  })
  console.log(`%c[#app基准] 记录 ${Object.values(appBaseline).reduce((a,b)=>a+b,0)} 个元素`, 'color: #909399')
}

/** 与 #app 基准对比，报告差异 */
export function diffAppBaseline(label: string): { added: Record<string, number>; removed: Record<string, number> } {
  const current = scanAppElements('')  // 不打印，手动打印
  const added: Record<string, number> = {}
  const removed: Record<string, number> = {}

  // 检查基准中有但当前没有的
  for (const [key, count] of Object.entries(appBaseline)) {
    const now = current[key] || 0
    if (now < count) {
      removed[key] = count - now
    }
  }
  // 检查基准中没有但当前有的
  for (const [key, count] of Object.entries(current)) {
    const base = appBaseline[key] || 0
    if (count > base) {
      added[key] = count - base
    }
  }

  const addedTotal = Object.values(added).reduce((a,b)=>a+b,0)
  const removedTotal = Object.values(removed).reduce((a,b)=>a+b,0)
  const currentTotal = Object.values(current).reduce((a,b)=>a+b,0)
  if (addedTotal > 0 || removedTotal > 0) {
    const addedList = Object.entries(added).map(([k, v]) => `${k}×${v}`)
    const removedList = Object.entries(removed).map(([k, v]) => `${k}×${v}`)
    console.log(`%c[#app差异] ${label}: 当前=${currentTotal}, 新增=${addedTotal}, 移除=${removedTotal}`,
      'color: #F56C6C; font-weight: bold')
    if (addedList.length) console.log('  新增:', addedList.join(', '))
    if (removedList.length) console.log('  移除:', removedList.join(', '))
  } else {
    console.log(`%c[#app差异] ${label}: 当前=${currentTotal}, 无差异 ✓`, 'color: #67C23A')
  }
  return { added, removed }
}

/** 扫描整个文档的游离元素（不在 #app 内的 body 子元素） */
export function scanOrphans(label: string): void {
  const result: string[] = []
  const bodyChildren = document.body.children
  for (let i = 0; i < bodyChildren.length; i++) {
    const el = bodyChildren[i]
    if (el.id === 'app') continue
    const tag = el.tagName.toLowerCase()
    result.push(`<${tag}> ${el.className?.toString().slice(0, 60) || ''} ${el.id || ''}`)
  }
  // 同时扫描 #app 内可疑的游离元素
  const app = document.getElementById('app')
  if (app) {
    const orphanSelectors = [
      '.el-popper', '.el-select-dropdown', '.el-overlay', '.el-tooltip__popper',
      '.el-dropdown__popper', '.el-picker__popper', '.el-message-box__wrapper',
      '.n-base-select-menu', '.n-popover', '.n-tooltip', '.n-dropdown-menu',
      '.v-binder-follower-container',
    ]
    orphanSelectors.forEach((sel) => {
      app.querySelectorAll(sel).forEach((el) => {
        result.push(`[#app内] <${el.tagName.toLowerCase()}> ${sel}`)
      })
    })
  }
  if (result.length > 0) {
    console.log(`%c[游离扫描] ${label}: 发现 ${result.length} 个游离元素`, 'color: #F56C6C', result)
  } else {
    console.log(`%c[游离扫描] ${label}: 干净`, 'color: #67C23A')
  }
}

/** 诊断工具：列出 body 下的游离元素（非 #app 直属） */
export function logLeakedDOM(label: string): string[] {
  const leaked: string[] = []
  const knownContainers = ['#app', 'head', 'script', 'style', 'link', 'meta', 'title', 'base', 'noscript']
  const children = document.body.children
  for (let i = 0; i < children.length; i++) {
    const el = children[i]
    if (el.id === 'app') continue
    if (knownContainers.includes(el.tagName.toLowerCase())) continue
    const summary = `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${el.className ? '.' + el.className.split(' ').slice(0, 3).join('.') : ''}>`
    leaked.push(summary)
  }
  console.log(`%c[DOM诊断] ${label}: body 下游离元素=${leaked.length}`, 'color: #E6A23C', leaked)
  return leaked
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
