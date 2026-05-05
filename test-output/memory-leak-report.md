# 表单内存泄漏自动化测试报告

> 生成时间: 2026-05-05T04:11:56.294Z
> 浏览器: Chromium (Playwright headless)
> 每模式交互: 5 个输入框 + 5 个下拉框 + 3 个表格输入

## 测试结果

| 模式 | 基线 DOM | 加载峰值 | 销毁后 | GC后 | **DOM 残留** | Heap 残留 |
|------|----------|----------|--------|------|-------------|-----------|
| FC + Element Plus | 73 | 12033 | 103 | 103 | **+30** | 6.4 MB |
| FC + Naive UI | 103 | 11280 | 122 | 122 | **+19** | 1.95 MB |
| 原生 Element Plus | 118 | 11443 | 118 | 118 | **+0** | 217.83 KB |
| 原生 Naive UI | 118 | 10667 | 118 | 118 | **+0** | 365.46 KB |

## 泄漏源分析

### DOM 泄漏

| 对比 | FC 版本 | 原生版本 | 泄漏源 |
|------|---------|----------|--------|
| Element Plus | +30 DOM | +0 DOM | **form-create** |
| Naive UI | +19 DOM | +0 DOM | **form-create** |

### 结论

✅ **原生组件 DOM 完全回收**（残留 ≤ 2），form-create 版本有残留。**泄漏源确认为 form-create。**

## 原始数据

```json
[
  {
    "mode": "FC+El",
    "btnText": "FC+El",
    "baselineHeap": 21254275,
    "baselineDOM": 73,
    "loadedHeap": 228569950,
    "loadedDOM": 12033,
    "postDestroyDOM": 103,
    "afterGCHeap": 27964188,
    "afterGCDOM": 103,
    "heapDelta": 207315675,
    "heapRetained": 6709913,
    "domRetained": 30
  },
  {
    "mode": "FC+Naive",
    "btnText": "FC+Naive",
    "baselineHeap": 28096405,
    "baselineDOM": 103,
    "loadedHeap": 149208251,
    "loadedDOM": 11280,
    "postDestroyDOM": 122,
    "afterGCHeap": 30143494,
    "afterGCDOM": 122,
    "heapDelta": 121111846,
    "heapRetained": 2047089,
    "domRetained": 19
  },
  {
    "mode": "原生El",
    "btnText": "原生 El",
    "baselineHeap": 30298663,
    "baselineDOM": 118,
    "loadedHeap": 177099264,
    "loadedDOM": 11443,
    "postDestroyDOM": 118,
    "afterGCHeap": 30521721,
    "afterGCDOM": 118,
    "heapDelta": 146800601,
    "heapRetained": 223058,
    "domRetained": 0
  },
  {
    "mode": "原生Naive",
    "btnText": "原生 Naive",
    "baselineHeap": 30641556,
    "baselineDOM": 118,
    "loadedHeap": 134905068,
    "loadedDOM": 10667,
    "postDestroyDOM": 118,
    "afterGCHeap": 31015783,
    "afterGCDOM": 118,
    "heapDelta": 104263512,
    "heapRetained": 374227,
    "domRetained": 0
  }
]
```
