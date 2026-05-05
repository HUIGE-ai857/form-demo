/**
 * 表单内存泄漏自动化测试
 * 对比 4 种模式：FC+El / FC+Naive / 原生 El / 原生 Naive
 */
import { test, expect, type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BASE_URL = 'http://localhost:5173'

// ── 工具函数 ──────────────────────────────────────────
async function sampleMemory(page: Page) {
  return page.evaluate(() => {
    const mem = (performance as any).memory
    return {
      heapUsed: mem?.usedJSHeapSize ?? -1,
      heapTotal: mem?.totalJSHeapSize ?? -1,
      domCount: document.querySelectorAll('*').length,
    }
  })
}

function fmt(bytes: number): string {
  if (bytes <= 0) return '-'
  const k = 1024
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i]
}

async function tryGC(page: Page) {
  await page.evaluate(() => (window as any).gc?.())
  await page.waitForTimeout(500)
}

// ── 页面操作 ──────────────────────────────────────────
async function clickBtn(page: Page, text: string) {
  const btn = page.locator('button', { hasText: text }).first()
  await btn.click({ timeout: 10000 })
  await page.waitForTimeout(500)
}

async function interactInputs(page: Page, selector: string, count: number) {
  for (let i = 0; i < count; i++) {
    const el = page.locator(selector).nth(i)
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      await el.click()
      await el.fill(`测试_${i}`)
      await page.waitForTimeout(150)
    }
  }
}

async function interactSelects(page: Page, selector: string, count: number) {
  for (let i = 0; i < count; i++) {
    const el = page.locator(selector).nth(i)
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      await el.click()
      await page.waitForTimeout(350)
      const opt = page.locator('.el-select-dropdown__item, .n-base-select-option').first()
      if (await opt.isVisible({ timeout: 800 }).catch(() => false)) {
        await opt.click()
      } else {
        await page.keyboard.press('Escape')
      }
      await page.waitForTimeout(200)
    }
  }
}

async function interactTable(page: Page, count: number) {
  // 只找非只读的 input（排除 el-select 的 readonly input）
  const inputs = page.locator('.inline-table input:not([readonly]), .naive-table input:not([readonly]), .el-table__body input:not([readonly])')
  const inputCount = await inputs.count()
  for (let i = 0; i < Math.min(count, inputCount); i++) {
    const el = inputs.nth(i)
    try {
      await el.click({ timeout: 3000 })
      await el.fill(`表_${i}`)
      await page.waitForTimeout(150)
    } catch { /* skip */ }
  }
}

async function sampleMultiple(page: Page, times: number, interval: number) {
  let bestHeap = Infinity
  let bestDom = Infinity
  for (let i = 0; i < times; i++) {
    await page.waitForTimeout(interval)
    const s = await sampleMemory(page)
    if (s.heapUsed > 0 && s.heapUsed < bestHeap) bestHeap = s.heapUsed
    if (s.domCount < bestDom) bestDom = s.domCount
  }
  return { heapUsed: bestHeap === Infinity ? -1 : bestHeap, domCount: bestDom }
}

// ── 单模式测试 ──────────────────────────────────────────
async function testMode(
  page: Page, mode: string, btnText: string, hasTabs: boolean,
) {
  console.log(`\n══ ${mode} ══`)

  // 切换模式
  await clickBtn(page, btnText)
  await page.waitForTimeout(500)

  // 基线
  await tryGC(page)
  const baseline = await sampleMemory(page)
  console.log(`  基线: DOM=${baseline.domCount}, Heap=${fmt(baseline.heapUsed)}`)

  // 加载
  await clickBtn(page, '加载所有表单')
  await page.waitForTimeout(2500)
  const loaded = await sampleMemory(page)
  console.log(`  加载: DOM=${loaded.domCount}, Heap=${fmt(loaded.heapUsed)}`)

  // Tab 切换（仅 FC 模式）
  if (hasTabs) {
    for (const tab of ['临床诊断信息', '检查与用药记录']) {
      const btn = page.locator('.tab-btn', { hasText: tab }).first()
      if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await btn.click()
        await page.waitForTimeout(400)
      }
    }
    const firstTab = page.locator('.tab-btn', { hasText: '患者基本信息' }).first()
    if (await firstTab.isVisible({ timeout: 1000 }).catch(() => false)) {
      await firstTab.click()
      await page.waitForTimeout(400)
    }
  }

  // 交互
  console.log('  交互: 输入框...')
  await interactInputs(page, '.form-section input[type="text"], .el-input__inner, .n-input__input-el', 5)
  console.log('  交互: 下拉框...')
  await interactSelects(page, '.form-section .el-select, .form-section .n-select', 5)
  console.log('  交互: 表格...')
  await interactTable(page, 3)

  // 销毁
  await clickBtn(page, '销毁所有表单')
  await page.waitForTimeout(2500)
  const postDestroy = await sampleMemory(page)
  console.log(`  销毁: DOM=${postDestroy.domCount}, Heap=${fmt(postDestroy.heapUsed)}`)

  // GC + 多次采样
  console.log('  等待 GC...')
  await tryGC(page)
  await page.waitForTimeout(3000)
  for (let i = 0; i < 3; i++) { await tryGC(page) }
  const afterGC = await sampleMultiple(page, 5, 1000)
  console.log(`  GC后: DOM=${afterGC.domCount}, Heap=${fmt(afterGC.heapUsed)}`)

  const domRetained = afterGC.domCount - baseline.domCount
  const heapDelta = loaded.heapUsed > 0 && baseline.heapUsed > 0
    ? loaded.heapUsed - baseline.heapUsed : -1
  const heapRetained = afterGC.heapUsed > 0 && baseline.heapUsed > 0
    ? afterGC.heapUsed - baseline.heapUsed : -1

  console.log(`  结论: DOM残留=${domRetained}, Heap残留=${fmt(heapRetained)}`)

  return {
    mode, btnText,
    baselineHeap: baseline.heapUsed, baselineDOM: baseline.domCount,
    loadedHeap: loaded.heapUsed, loadedDOM: loaded.domCount,
    postDestroyDOM: postDestroy.domCount,
    afterGCHeap: afterGC.heapUsed, afterGCDOM: afterGC.domCount,
    heapDelta, heapRetained, domRetained,
  }
}

// ── 测试 ────────────────────────────────────────────────
test.describe('内存泄漏对比测试', () => {
  test.setTimeout(300000)

  test('完整 4 模式测试并生成报告', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)

    // 必须顺序执行，不能并行（共用一个页面实例）
    const r1 = await testMode(page, 'FC+El', 'FC+El', true)
    const r2 = await testMode(page, 'FC+Naive', 'FC+Naive', true)
    const r3 = await testMode(page, '原生El', '原生 El', false)
    const r4 = await testMode(page, '原生Naive', '原生 Naive', false)
    const results = [r1, r2, r3, r4]

    // ── 生成报告 ──────────────────────────────────────
    const fcEl = results[0], fcNaive = results[1]
    const nativeEl = results[2], nativeNaive = results[3]

    // 判断 DOM 泄漏来源（DOM 数据可靠）
    const elDomLeakSource =
      nativeEl.domRetained <= 2 && fcEl.domRetained > 5 ? 'form-create'
      : fcEl.domRetained <= 5 ? '无泄漏'
      : nativeEl.domRetained > 5 ? 'Element Plus + form-create'
      : 'form-create'

    const naiveDomLeakSource =
      nativeNaive.domRetained <= 2 && fcNaive.domRetained > 5 ? 'form-create'
      : fcNaive.domRetained <= 5 ? '无泄漏'
      : nativeNaive.domRetained > 5 ? 'Naive UI + form-create'
      : 'form-create'

    console.log('\n\n')
    console.log('╔══════════════════════════════════════╗')
    console.log('║        DOM 泄漏对比结果              ║')
    console.log('╠══════════════════════════════════════╣')
    console.log(`║ FC+El    DOM残留: ${String(fcEl.domRetained).padStart(4)}              ║`)
    console.log(`║ 原生El    DOM残留: ${String(nativeEl.domRetained).padStart(4)}              ║`)
    console.log(`║ FC+Naive DOM残留: ${String(fcNaive.domRetained).padStart(4)}              ║`)
    console.log(`║ 原生Naive DOM残留: ${String(nativeNaive.domRetained).padStart(4)}              ║`)
    console.log('╠══════════════════════════════════════╣')
    console.log(`║ El 泄漏源: ${elDomLeakSource.padEnd(25)} ║`)
    console.log(`║ Naive 泄漏源: ${naiveDomLeakSource.padEnd(22)} ║`)
    console.log('╚══════════════════════════════════════╝')

    // ── 写入报告文件 ──────────────────────────────────
    const reportDir = path.resolve(__dirname, '../test-output')
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true })

    const reportMd = `# 表单内存泄漏自动化测试报告

> 生成时间: ${new Date().toISOString()}
> 浏览器: Chromium (Playwright headless)
> 每模式交互: 5 个输入框 + 5 个下拉框 + 3 个表格输入

## 测试结果

| 模式 | 基线 DOM | 加载峰值 | 销毁后 | GC后 | **DOM 残留** | Heap 残留 |
|------|----------|----------|--------|------|-------------|-----------|
| FC + Element Plus | ${fcEl.baselineDOM} | ${fcEl.loadedDOM} | ${fcEl.postDestroyDOM} | ${fcEl.afterGCDOM} | **+${fcEl.domRetained}** | ${fmt(fcEl.heapRetained)} |
| FC + Naive UI | ${fcNaive.baselineDOM} | ${fcNaive.loadedDOM} | ${fcNaive.postDestroyDOM} | ${fcNaive.afterGCDOM} | **+${fcNaive.domRetained}** | ${fmt(fcNaive.heapRetained)} |
| 原生 Element Plus | ${nativeEl.baselineDOM} | ${nativeEl.loadedDOM} | ${nativeEl.postDestroyDOM} | ${nativeEl.afterGCDOM} | **+${nativeEl.domRetained}** | ${fmt(nativeEl.heapRetained)} |
| 原生 Naive UI | ${nativeNaive.baselineDOM} | ${nativeNaive.loadedDOM} | ${nativeNaive.postDestroyDOM} | ${nativeNaive.afterGCDOM} | **+${nativeNaive.domRetained}** | ${fmt(nativeNaive.heapRetained)} |

## 泄漏源分析

### DOM 泄漏

| 对比 | FC 版本 | 原生版本 | 泄漏源 |
|------|---------|----------|--------|
| Element Plus | +${fcEl.domRetained} DOM | +${nativeEl.domRetained} DOM | **${elDomLeakSource}** |
| Naive UI | +${fcNaive.domRetained} DOM | +${nativeNaive.domRetained} DOM | **${naiveDomLeakSource}** |

### 结论

${nativeEl.domRetained <= 2 && nativeNaive.domRetained <= 2
    ? '✅ **原生组件 DOM 完全回收**（残留 ≤ 2），form-create 版本有残留。**泄漏源确认为 form-create。**'
    : nativeEl.domRetained > 5 || nativeNaive.domRetained > 5
    ? '⚠️ **原生组件也存在 DOM 残留**，泄漏可能来自 Element Plus/Naive UI 自身。'
    : '⚠️ 结果不明确，需要进一步测试。'}

## 原始数据

\`\`\`json
${JSON.stringify(results, null, 2)}
\`\`\`
`
    fs.writeFileSync(path.join(reportDir, 'memory-leak-report.md'), reportMd)
    console.log(`\n报告已生成: test-output/memory-leak-report.md`)

    // JSON 报告
    fs.writeFileSync(path.join(reportDir, 'memory-leak-data.json'), JSON.stringify({
      timestamp: new Date().toISOString(),
      results,
      analysis: { elDomLeakSource, naiveDomLeakSource },
    }, null, 2))
  })
})
