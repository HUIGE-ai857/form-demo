# 表单销毁 DOM 清理测试记录

## 测试环境

- Vue 3.5 + form-create 3.2
- Element Plus 2.9 + Naive UI 2.44
- 每 Tab 约 700 个表单字段，3 个 Tab 共约 2100 个组件

## 问题描述

销毁表单后 DOM 未完全回收，具体表现：

| 场景 | Element Plus | Naive UI |
|---|---|---|
| select 选择下拉框选项后销毁 | DOM 不销毁 | DOM 正常销毁 |
| input 输入内容后销毁 | DOM 不销毁 | DOM 不销毁 |

## 第一轮优化 (v1)

**提交**: `e929043`

### 分析

Element Plus 和 Naive UI 的下拉框、弹出层、tooltip 等组件会在 `body` 或组件树外创建游离 DOM（popper/overlay）。当 Vue 通过 `v-if` 销毁组件树时，这些游离 DOM 不受 Vue 管理，因此不会被清理。

### 改动

1. **`memoryUtils.ts`**: 新增三个工具函数：
   - `blurActiveElement()` — 模糊当前焦点元素，关闭打开的弹出层
   - `cleanOrphanedDOM()` — 按选择器强制移除 Element Plus/Naive UI 的游离 DOM
   - `preDestroyCleanup()` — 销毁前综合清理

2. **所有 tab 组件**: `onBeforeUnmount` 中调用 `preDestroyCleanup()` + 重置响应式数据
3. **`App.vue`**: `toggleForms` 销毁路径中 nextTick 后和 2s 后各调用一次 `cleanOrphanedDOM()`

### 测试结果

**未生效，效果与修改前相同。**

### 结论

游离 popper/overlay 选择器清理不够，泄漏的 DOM 可能来自：
- form-create 内部组件未正确销毁
- DOM 残留不在已知选择器覆盖范围
- 需要更底层的清理手段

---

## 第二轮优化 (v2)

**提交**: `e453149`

### 分析

仅按选择器清理不够，需要：
1. 物理层面强制清空表单容器 DOM
2. 追踪 body 下新增元素并移除
3. 每个 tab 组件自身也进行 DOM 强制清除
4. 添加诊断工具查看具体泄漏了哪些元素

### 改动

1. **`memoryUtils.ts`**:
   - `logLeakedDOM(label)` — 诊断工具，列出 body 下游离元素
   - `captureDOMBaseline()` — 页面初始化时拍下 body 子元素快照
   - `removeLeakedSinceBaseline()` — 对比基线，移除所有新增 body 子元素

2. **`App.vue`**:
   - 表单区域包裹 `<div ref="formWrapper">` 容器
   - 销毁流程改为：`nextTick` → 50ms 延迟 → `formWrapper.innerHTML = ''` → `removeLeakedSinceBaseline()` → `cleanOrphanedDOM()`
   - 2 秒后二次清理同上
   - 页面初始化时调用 `captureDOMBaseline()`

3. **6 个 tab 组件**:
   - 添加 `rootRef` 引用根元素
   - `onBeforeUnmount` 中增加 `rootRef.value.innerHTML = ''` 强制清除

### 清理层次

```
onBeforeUnmount (每个 tab)
  ├── blurActiveElement()
  ├── formGroups = [], tableRows = []
  └── rootRef.innerHTML = ''

nextTick + 50ms (App.vue)
  ├── formWrapper.innerHTML = ''
  ├── removeLeakedSinceBaseline()
  └── cleanOrphanedDOM()

2s 后 (App.vue)
  ├── formWrapper.innerHTML = ''
  ├── removeLeakedSinceBaseline()
  └── cleanOrphanedDOM()
```

### 测试结果

**未生效**，具体数据（Element Plus 模式）：

| 阶段 | DOM 数量 | Heap |
|---|---|---|
| 初始化基准 | 70 | 75 MB |
| 加载表单后 | 12,023 | 272 MB |
| 销毁表单后 | 100 | 184 MB |
| 与基线差值 | **+30** | +108 MB |

关键发现：
- body 层面清理成功：`removeLeakedSinceBaseline` 移除了 1 个元素 (`div#el-popper-container-1220`)
- **30 个泄漏元素不在 body，而在 `#app` 内部**
- `formWrapper.innerHTML = ''` 未能清除它们，说明泄漏元素在 wrapper 外部（可能是 Element Plus 内部缓存或 popper 容器）

---

## 第三轮优化 (v3)

**提交**: 待提交

### 分析

v2 通过暴力清除 DOM（`innerHTML = ''`）仍留下 +30 个元素，说明问题不在 DOM 清除不彻底，而是：

1. **form-create 内部实例未被正确销毁** — 组件卸载时 Vue 会销毁 DOM，但 form-create 内部的响应式 watcher/effect 可能持有 DOM 引用，阻止 GC
2. **泄漏元素在 `#app` 内但 wrapper 外** — 来自 Element Plus 内部创建的共享容器（如 `.el-popper-container`）

### 改动

**核心：显式调用 `fApi.destroy()`**

1. **6 个 tab 组件**：每个 form-create 组件添加 `v-model:api="formApis[idx]"`，在 `onBeforeUnmount` 中遍历调用 `api.destroy()` 逐个销毁实例

```html
<ElFormCreate :rule="rules" :option="formOption" v-model:api="formApis[idx]" />
```

```ts
onBeforeUnmount(() => {
  preDestroyCleanup()
  formApis.value.forEach(api => { if (api?.destroy) try { api.destroy() } catch (e) {} })
  formApis.value = []
  formGroups.value = []
  tableRows.value = []
  if (rootRef.value) { rootRef.value.innerHTML = '' }
})
```

2. **`memoryUtils.ts`**：新增诊断工具
   - `scanAppElements(label)` — 扫描 `#app` 内所有元素按标签+类名分组统计，用于对比基准和销毁后的差异
   - `scanOrphans(label)` — 扫描 body 和 `#app` 内的游离元素

3. **`App.vue`**：诊断调用
   - 初始化时 `scanAppElements('初始化基准')`
   - 销毁后 `scanAppElements('销毁清理后')` + `scanOrphans('销毁清理后')`
   - 2s 后再次扫描

### 测试结果

**未生效**，具体数据（Element Plus 模式，`fApi.destroy()` 版本）：

| 阶段 | DOM | Heap | #app 扫描 |
|---|---|---|---|
| 初始化基准 | 70 | 35 MB | - |
| 加载表单后 | 12,023 | 249 MB | - |
| 销毁清理后 | **100** | 143 MB | 65 元素 |
| 2s 二次清理后 | **100** | 143 MB | 71 元素 (+6 snapshot 行) |
| 与基线差值 | **+30** | +108 MB | - |

关键发现：
- **`fApi.destroy()` 对 DOM 泄漏无效**，调用前 DOM=100，调用后仍是 100
- `[#app扫描]` 显示 65→71 的变化来自 MemoryMonitor 新增的快照历史行（`.snap-row` × 6 + 子元素）
- body 清理成功（1 个 `#el-popper-container` 被移除），`#app` 内无游离 popper
- **Heap 仍保留 108 MB**，说明 JS 对象引用链未被切断

---

## 第四轮优化 (v4)

**提交**: 待提交

### 分析

v3 的 `fApi.destroy()` 未能切断 Heap 引用，说明 form-create 内部可能在全局 store 中缓存实例，或 `destroy()` 本身不彻底。需要从两个层面入手：

1. **引用切断**：在 `destroy()` 之外，遍历 API 的所有属性强制置 null
2. **数据深清**：formGroups/rules 中每个对象全部属性置 null，再清空数组
3. **精确诊断**：新增 `[#app基准]` / `[#app差异]` 对比，精确定位泄漏元素

### 改动

1. **6 个 tab 组件 `onBeforeUnmount`**：

```ts
onBeforeUnmount(() => {
  preDestroyCleanup()
  formApis.value.forEach(api => {
    if (!api) return
    try { api.reset() } catch (e) {}
    try { api.clearValidateState() } catch (e) {}
    try { api.destroy() } catch (e) {}
    // 遍历所有属性强制置 null
    try { Object.keys(api).forEach(k => { try { api[k] = null } catch (e) {} }) } catch (e) {}
  })
  // 深度置空 rule 中每个对象的所有属性
  formGroups.value.forEach(group => {
    group.forEach(rule => { if (rule) try { Object.keys(rule).forEach(k => { try { (rule as any)[k] = null } catch (e) {} }) } catch (e) {} })
    try { group.length = 0 } catch (e) {}
  })
  // 置空表格数据每个 cell
  tableRows.value.forEach(row => { if (row) try { Object.keys(row).forEach(k => { try { row[k] = null } catch (e) {} }) } catch (e) {} })
  formApis.value.length = 0
  formGroups.value.length = 0
  tableRows.value.length = 0
  if (rootRef.value) { rootRef.value.innerHTML = '' }
})
```

2. **`memoryUtils.ts`**：新增 `#app` 基准对比
   - `captureAppBaseline()` — 初始化时记录 `#app` 内所有元素
   - `diffAppBaseline(label)` — 对比当前与基准，输出新增/移除元素明细

3. **`App.vue`**：初始化调用 `captureAppBaseline()`，销毁后调用 `diffAppBaseline()`

### 测试结果

**运行时错误**，`Object.keys(api).forEach(k => { api[k] = null })` 导致 form-create 内部 `hasOwnProperty` 收到 null 而抛出 `TypeError`：
```
Uncaught (in promise) TypeError: Cannot convert undefined or null to object
    at hasOwnProperty → hasProperty → tidyBool → CustomManager2.tidyOptions → mergeOptions → updateOptions
```

### 结论

`api.destroy()` 后立即置空属性不可行，form-create 内部有异步 watcher 仍需访问这些属性。

---

## 第四轮 v4.1：修复 v4 错误 + v5 策略

**提交**: 待提交

### 分析

v4 证明了激进置 null 会破坏 form-create 内部逻辑。需要从根本上隔离表单组件，而非试图清理残留。

### v5 核心改动

**表单 wrapper 由 `v-if` + `:key` 控制**：不再让 wrapper 永久存在然后清空 innerHTML，而是直接销毁重建：

```html
<!-- 旧：wrapper 一直存在，仅子组件由 v-if 控制 -->
<div ref="formWrapper" class="form-wrapper">
  <TabContainer v-if="showForms" ... />
</div>

<!-- 新：wrapper 自身由 v-if + :key 控制 -->
<div v-if="showForms" :key="'fw-' + wrapperKey" class="form-wrapper">
  <TabContainer v-if="uiMode === 'element'" ... />
</div>
```

销毁时：`wrapperKey++` → Vue 销毁整个 wrapper div（含所有子 DOM、组件实例、watcher）→ 重建新的空 wrapper 供下次使用。

### 其它修复

- 移除 v4 中所有 `Object.keys(api).forEach(k => api[k] = null)` 和深度置 null
- 保留 `api.reset()` + `api.clearValidateState()` + `api.destroy()`
- 移除 `formWrapper.innerHTML = ''` 清理（wrapper 通过 v-if 销毁，无需手动清）

### 测试结果

**DOM 未释放，Heap 未释放**，手动 GC 无效。

| 阶段 | DOM | Heap | #app 差异 |
|---|---|---|---|
| 初始化基准 | 69 | 36.5 MB | 35 元素 |
| 加载后 | 12,023 | 253 MB | - |
| 销毁清理后 | 99 | 197 MB | +30 元素 |
| 2s 二次清理 | 99 | 197 MB | +36 元素 (+6 snapshot) |

- `[#app差异]` 显示新增 30 元素（对比 35 基准），但**未输出具体元素名**（需展开对象）
- wrapper `v-if` + `:key` 重建对 DOM 泄漏无改善
- **Heap 保留 161 MB**（197 - 36），说明 JS 对象引用链始终未断

---

## 第五轮实际测试 (v5)

见上方 v5 测试数据。

---

## 第六轮优化 (v6)

**提交**: 待提交

### 分析

v1-v5 从 DOM 清理、API 销毁、wrapper 重建多个角度尝试，Heap 始终保留 ~160 MB。怀疑根因在于 **Vue 响应式系统创建了大量 Proxy 对象**（每组 60 field × 10 组 = 600 个 rule 对象，每个对象被 Vue 的 `ref` 深度代理）。

`ref()` 默认为深度响应式，600 个 rule × 每个 rule 约 5-6 个属性 = ~3000 个响应式 Proxy。销毁组件时这些 Proxy 引用链可能未被完全回收。

### 改动

将 `formGroups` 从 `ref` 改为 `shallowRef`：

```ts
// 旧: 深度响应式，每个 rule 对象的每个属性都创建 Proxy
const formGroups = ref<FormRule[][]>([])

// 新: 仅追踪数组本身，内部对象不做 Proxy
const formGroups = shallowRef<FormRule[][]>([])
```

formGroups 的数据（rule 数组）在 `onMounted` 中一次性生成后不再修改，不需要深度响应式。改用 `shallowRef` 后，响应式 Proxy 数量从 ~3000+ 降至 1。

同时修复 `[#app差异]` 输出：新增/移除的元素名直接展开在日志中，无需手动点开对象。

### 测试结果

待测试。

---

## 诊断方法

### 控制台日志

- `[DOM基准]` — 页面初始化时记录的 body 子元素
- `[DOM诊断]` — 销毁后的 body 游离元素列表
- `[清理游离DOM]` — 被移除的泄漏元素
- `[快照]` — 各阶段 Heap/DOM 快照
- `[内存监测]` — 销毁/加载后的内存变化

### 手动排查

1. 打开 Chrome DevTools → Elements
2. 加载表单 → 交互操作 → 销毁表单
3. 在 Elements 面板查看 `<body>` 下是否有多余元素
4. 查看 `document.querySelectorAll('*').length` 对比基线

### Memory Profiler

1. DevTools → Memory → 选中 "Heap snapshot"
2. 加载表单前拍一次快照
3. 加载表单 → 交互 → 销毁表单
4. 手动触发 GC（DevTools → Performance → 点击垃圾桶图标）
5. 再拍一次快照，对比两次的 "Detached DOM" 节点数

---

## Playwright 自动化对比测试

**提交**: `c7f4689` (原生组件) + 后续测试脚本

### 测试设计

新增 `NativeElementTab` 和 `NativeNaiveTab` 两个页面，渲染与 form-create 版本同等数量（~600）的原生 `el-input`/`el-select`/`n-input`/`n-select`。通过 Playwright 自动化脚本对比 4 种模式的 DOM/Heap 残留。

### 测试结果 (Chromium headless, `--enable-precise-memory-info`)

| 模式 | 基线 DOM | 加载峰值 | GC后 DOM | **DOM 残留** | 基线 Heap | GC后 Heap | Heap 残留 |
|------|----------|----------|----------|-------------|-----------|-----------|-----------|
| FC + Element Plus | 73 | 12,033 | 103 | **+30** | 20.3 MB | 26.7 MB | 6.4 MB |
| FC + Naive UI | 103 | 11,280 | 122 | **+19** | 26.8 MB | 28.8 MB | 2.0 MB |
| **原生 Element Plus** | 118 | 11,443 | 118 | **0** | 28.9 MB | 29.1 MB | 218 KB |
| **原生 Naive UI** | 118 | 10,667 | 118 | **0** | 29.2 MB | 29.6 MB | 365 KB |

### 结论

```
╔══════════════════════════════════════╗
║        DOM 泄漏对比结果              ║
╠══════════════════════════════════════╣
║ FC+El    DOM残留:   30              ║
║ 原生El    DOM残留:    0              ║
║ FC+Naive DOM残留:   19              ║
║ 原生Naive DOM残留:    0              ║
╠══════════════════════════════════════╣
║ El 泄漏源:  form-create              ║
║ Naive 泄漏源: form-create            ║
╚══════════════════════════════════════╝
```

**✅ 结论确认：泄漏源是 form-create，不是 Element Plus 或 Naive UI。**

- 原生 Element Plus 和 Naive UI 组件在销毁后 DOM 完全回到基线（残留 = 0）
- form-create 版本存在 +19~30 的 DOM 残留
- Heap 方面，GC 后 4 个模式都能回到基线附近（< 7 MB），说明 JS 对象引用最终能被回收
- 但 form-create 版本的 DOM 节点始终比基线多 19-30 个，这些是 form-create 内部创建的游离 DOM

### 测试脚本

- 测试文件: `tests/memory-leak.spec.ts`
- Playwright 配置: `playwright.config.ts`
- 报告输出: `test-output/memory-leak-report.md`
- JSON 数据: `test-output/memory-leak-data.json`

### 运行方式

```bash
# 1. 确保 dev server 在运行
npm run dev

# 2. 运行测试
npx playwright test --config playwright.config.ts

# 3. 查看报告
cat test-output/memory-leak-report.md
```
