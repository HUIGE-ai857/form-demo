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
