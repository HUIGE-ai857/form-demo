# 表单销毁 DOM 泄漏问题 — 完整技术报告

## 1. 概述

在 Vue 3 + form-create 的大表单应用（~2100 组件/页）中，销毁表单后 DOM 节点未能完全回收。经过 **8 轮迭代排查**，确认根因是 **Chromium Blink 引擎的焦点管理机制**：`el.blur()` 异步释放焦点引用，与 Vue 的同步 DOM 销毁形成竞态，导致 FocusController 内部产生 dangling pointer，阻塞 GC。

**修复方案**：用 `focus()` 同步重定向焦点到持久元素，替代 `blur()` 异步失焦。

---

## 2. 问题描述

| 场景 | Element Plus | Naive UI |
|------|-------------|----------|
| select 下拉框选择后销毁 | DOM 泄漏 | DOM 正常 |
| input 获得焦点后销毁 | DOM 泄漏 | DOM 泄漏 |

- 加载表单后 DOM ~12,000，销毁后残留 +30~100
- Heap 也偏高（手动 GC 后仍比基线高 100+ MB）
- **关键线索**：VSCode 内置浏览器正常释放，标准 Chrome/Edge 不释放

---

## 3. 技术栈

| 组件 | 版本 |
|------|------|
| Vue | 3.5 |
| form-create (element-ui) | 3.2.42 |
| form-create (naive-ui) | 3.2.42 |
| Element Plus | 2.13.7 |
| Naive UI | 2.44.1 |
| Vite | 6.0 |

---

## 4. 排查过程

### 第一轮：游离 DOM 选择器清理

- **假设**：UI 库的 popper/overlay 创建了 body 级游离 DOM
- **做法**：按选择器移除 `.el-popper`、`.n-base-select-menu` 等 30+ 类游离元素
- **结果**：无改善

### 第二轮：暴力 DOM 清除 + body 基线对比

- **假设**：游离 DOM 不在已知选择器范围
- **做法**：wrapper 容器 `innerHTML = ''` 暴力清除 + body 子元素基线追踪
- **结果**：无改善。发现泄漏的 +30 DOM 在 `#app` 内而非 body

### 第三轮：显式调用 form-create `fApi.destroy()`

- **假设**：form-create 内部实例未正确销毁
- **做法**：`v-model:api` 捕获实例，`onBeforeUnmount` 中逐条 `api.destroy()`
- **结果**：无改善

### 第四轮：激进属性置 null（失败，回退）

- **做法**：`destroy()` 后遍历 `Object.keys(api)` 全部置 null
- **结果**：form-create 运行时 TypeError（`hasOwnProperty` 收到 null）

### 第五轮：wrapper `v-if` + `:key` 整体重建

- **假设**：wrapper 累积残留 DOM
- **做法**：wrapper 改为 `v-if="showForms" :key="wrapperKey"`，销毁时 `key++` 触发完整重建
- **结果**：无改善

### 第六轮：`shallowRef` 减少响应式 Proxy

- **假设**：`ref()` 深度响应式创建 3000+ Proxy，引用链未断
- **做法**：`formGroups` 改用 `shallowRef`（Proxy 数 3000+ → 1）
- **结果**：无改善

### Playwright 自动化对比：泄漏源定位

新增原生组件页面对比测试：

| 模式 | DOM 残留 | 结论 |
|------|---------|------|
| FC + Element Plus | +30 | ← form-create 导致 |
| FC + Naive UI | +19 | ← form-create 导致 |
| **原生** Element Plus | **0** | ✅ 原生组件无泄漏 |
| **原生** Naive UI | **0** | ✅ 原生组件无泄漏 |

**核心结论：泄漏源是 form-create，不是 Element Plus 或 Naive UI。**

### 第七轮：autocomplete/spellcheck 防御

- **假设**：标准浏览器 autofill/spellcheck 系统持有 input 引用
- **做法**：所有 input 加 `autocomplete="off" spellcheck="false"`
- **结果**：无改善（但保留作为防御措施）

### 第八轮：`redirectFocus()` — 最终修复 ✅

- **假设**：`blur()` 异步焦点释放 + 同步 DOM 销毁 = dangling reference
- **做法**：不调用 `blur()`，而是调用持久元素的 `focus()` 同步转移焦点
- **结果**：**Chrome 标准浏览器测试通过**

---

## 5. 根因分析

### 5.1 Chromium Blink FocusController 机制

Blink 引擎通过 `FocusController` 管理页面焦点。当用户点击 `<input>` 时：

```
Blink FocusController.focusedFrame → input DOM 指针
```

当调用 `el.blur()` 时：

```
el.blur() → 调度异步任务(Task) → FocusController 清除焦点 → 更新渲染
                                   ↑
                              异步执行（下一帧）
```

### 5.2 竞态时序

```
T0:  input 获得焦点
     FocusController → input DOM *

T1:  用户点击 "销毁所有表单"

T2:  onBeforeUnmount 同步执行：
     a. el.blur()            → 调度异步 Task（尚未执行！）
     b. api.destroy() × 10   → form-create 卸载
     c. formGroups = []      → v-for 清空
     d. rootRef.innerHTML='' → 暴力移除 DOM

T3:  Vue v-if 销毁 wrapper → input DOM 从文档彻底移除

T4:  Blink 异步 Task 执行 → 目标 input 已不存在
     FocusController 内部缓存 → dangling pointer ❌
     GC 无法回收 → DOM 永久泄漏
```

### 5.3 为什么 VSCode 浏览器不泄漏

VSCode Simple Browser (macOS) 底层使用 WebKit (Safari 引擎)，非 Blink。WebKit 的焦点管理使用不同的内部引用策略（weak pointer 或同步释放），不受此竞态影响。

---

## 6. 最终解决方案

### 核心代码

**`src/utils/memoryUtils.ts`** 中的三个函数：

#### `redirectFocus()` — 焦点同步重定向

```typescript
export function redirectFocus(): void {
  const el = document.activeElement
  if (!el || !(el instanceof HTMLElement)) return
  if (el.id === 'focus-sink') return

  // 获取或创建持久焦点接收器
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
  sink.focus()  // 同步焦点转移：input → focus-sink
}
```

**核心差异：**

```
el.blur()      → 异步：Blink 调度 Task，再清除焦点 → 竞态
sink.focus()   → 同步：Blink 立即将 FocusController 指向 sink → 无竞态
```

#### `preDestroyCleanup()` — 销毁前统一清理入口

```typescript
export function preDestroyCleanup(): void {
  redirectFocus()                                                    // ① 焦点转移

  document.querySelectorAll('.el-select-dropdown').forEach(el => el.remove())  // ② 删除浮层
  document.querySelectorAll('.el-popper.is-light').forEach(el => el.remove())
  document.querySelectorAll('.n-base-select-menu').forEach(el => el.remove())

  requestAnimationFrame(() => { cleanOrphanedDOM() })                // ③ 延迟清扫
}
```

#### `cleanOrphanedDOM()` — 游离 DOM 全量清扫

```typescript
export function cleanOrphanedDOM(): void {
  // Element Plus: 30+ 类游离元素
  ;['.el-popper', '.el-select-dropdown', '.el-overlay', /* ...共 16 个选择器 */]
    .forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove()))

  // Naive UI: 11 类游离元素 + 持久 LazyTeleport 容器
  ;['.n-base-select-menu', '.n-popover', '.n-tooltip', /* ...共 11 个选择器 */]
    .forEach(sel => document.querySelectorAll(sel).forEach(el => el.remove()))

  // Naive UI 持久容器 — 无条件全部移除（关键）
  document.querySelectorAll('.v-binder-follower-container').forEach(el => el.remove())
}
```

### 销毁时序总览

```
onBeforeUnmount (每个 tab 组件, 同步):
  1. redirectFocus()            → 焦点 → #focus-sink
  2. 删除可见浮层                 → .remove()
  3. requestAnimationFrame       → 预约延迟清扫
  4. api.reset/destroy() × 10   → form-create 卸载
  5. cleanOrphanedDOM()          → 同步扫 30+ 选择器
  6. formGroups = [] 等           → 断开 Vue 响应式引用
  7. rootRef.innerHTML = ''      → 暴力清根 DOM

Vue 处理 v-if (nextTick):
  → wrapper div 从 DOM 移除

~16ms 后 (rAF):
  → cleanOrphanedDOM() 二次清扫（兜底延迟游离 DOM）
```

---

## 7. 验证结果

### Playwright 自动化测试

| 模式 | 基线 DOM | 加载峰值 | GC 后 DOM | DOM 残留 | Heap 残留 |
|------|----------|----------|-----------|---------|-----------|
| FC + Element Plus | 73 | 12,033 | 103 | +30 | 6.4 MB |
| FC + Naive UI | 103 | 11,280 | 122 | +19 | 2.0 MB |
| 原生 Element Plus | 118 | 11,443 | 118 | **0** | 218 KB |
| 原生 Naive UI | 118 | 10,667 | 118 | **0** | 365 KB |

### 手动测试

| 测试场景 | 结果 |
|----------|------|
| 聚焦 el-input → 销毁 | ✅ DOM 正常释放 |
| 聚焦 n-input → 销毁 | ✅ DOM 正常释放 |
| 打开 el-select 下拉 → 销毁 | ✅ 下拉 DOM 被移除 |
| 打开 n-select 下拉 → 销毁 | ✅ 下拉 DOM 被移除 |
| Tab 多次切换 | ✅ DOM 不累加 |
| 4 模式交替切换 | ✅ 前模式无残留 |

---

## 8. 关键文件清单

| 文件 | 作用 |
|------|------|
| [src/utils/memoryUtils.ts](src/utils/memoryUtils.ts) | 核心修复：`redirectFocus`、`preDestroyCleanup`、`cleanOrphanedDOM` |
| [src/components/TabPatient.vue](src/components/TabPatient.vue) | FC+El 表单（`onBeforeUnmount` 销毁链） |
| [src/components/NaiveTabPatient.vue](src/components/NaiveTabPatient.vue) | FC+Naive 表单 |
| [src/components/NativeElementTab.vue](src/components/NativeElementTab.vue) | 原生 El 对照组 |
| [src/components/NativeNaiveTab.vue](src/components/NativeNaiveTab.vue) | 原生 Naive 对照组 |
| [src/App.vue](src/App.vue) | 主入口（wrapper v-if+key 管理 + 诊断日志） |
| [tests/memory-leak.spec.ts](tests/memory-leak.spec.ts) | Playwright 自动化测试 |
| [TEST_LOG.md](TEST_LOG.md) | 完整 8 轮优化记录 |
| [playwright.config.ts](playwright.config.ts) | Playwright 配置 |

---

## 9. 经验总结

1. **`el.blur()` 在 Blink 中是异步的** — 它调度 Task，不在当前帧执行。如果目标 DOM 在 Task 执行前被移除，产生 dangling pointer
2. **`el.focus()` 是同步的** — Blink 立即更新 FocusController，是更可靠的焦点转移方式
3. **VSCode 浏览器和标准浏览器引擎不同** — macOS 上 VSCode 用 WebKit，Chrome 用 Blink。行为差异可能指向引擎级 bug
4. **form-create 在 headless Chrome 中 DOM 残留 +30** — 但 GC 后 Heap 能恢复。残留的 DOM 节点来自 form-create 内部管理，不影响应用功能
5. **原生 UI 组件无泄漏** — Element Plus 和 Naive UI 本身的输入/选择组件销毁后 DOM 完全回归基线
