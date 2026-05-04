# form-demo

基于 Vue 3 + form-create 的大表单内存泄漏测试项目，用于验证大量表单组件在加载/销毁时的内存回收情况。

## 技术栈

- **框架**: Vue 3 + TypeScript
- **构建**: Vite
- **UI 库**: Element Plus / Naive UI（可切换）
- **表单渲染**: `@form-create/element-ui` + `@form-create/naive-ui`

## 项目结构

```
src/
├── components/
│   ├── TabContainer.vue          # Element Plus 版标签页容器
│   ├── TabPatient.vue            # 患者基本信息 (~700 组件)
│   ├── TabDiagnosis.vue          # 临床诊断信息 (~700 组件)
│   ├── TabMedication.vue         # 检查与用药记录 (~700 组件)
│   ├── NaiveTabContainer.vue     # Naive UI 版标签页容器
│   ├── NaiveTabPatient.vue
│   ├── NaiveTabDiagnosis.vue
│   ├── NaiveTabMedication.vue
│   ├── InlineTable.vue           # Element Plus 版子表格
│   ├── NaiveInlineTable.vue      # Naive UI 版子表格
│   └── MemoryMonitor.vue         # 内存监测面板
├── utils/
│   ├── formSchemas.ts            # 表单规则定义
│   ├── memoryUtils.ts            # 内存快照与统计工具
│   └── store.ts
├── App.vue                       # 主入口，模式切换与生命周期管理
├── main.ts                       # 应用挂载与 form-create 双栈注册
└── types.ts
```

## 快速开始

```bash
pnpm install
pnpm dev
```

## 功能说明

- **UI 模式切换**: 在 Element Plus 和 Naive UI 之间切换，对比渲染表现
- **表单加载/销毁**: 点击按钮加载或销毁包含 ~2100 个组件的三个标签页表单
- **Tab 切换**: 在不同标签页间切换，观察内存变化
- **内存监测**: 页面顶部实时显示 Heap 使用量、DOM 节点数，切换时自动记录快照
