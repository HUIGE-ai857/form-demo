<script setup lang="ts">
import { ref, watch, nextTick, onErrorCaptured, onMounted } from 'vue'
import MemoryMonitor from './components/MemoryMonitor.vue'
import TabContainer from './components/TabContainer.vue'
import NaiveTabContainer from './components/NaiveTabContainer.vue'
import { getMemoryInfo, takeSnapshot, formatBytes, getSnapshotHistory } from './utils/memoryUtils'

const uiMode = ref<'element' | 'naive'>('element')
const activeTab = ref('patient')
const showForms = ref(false)
const tabKey = ref(0)
const switchCount = ref(0)

onMounted(() => {
  takeSnapshot('页面初始化(无表单)')
})

onErrorCaptured((err) => {
  console.warn('%c[组件异常]', 'color:#F56C6C', err.message)
  return false
})

const tabLabels: Record<string, string> = {
  patient: '患者基本信息 (~700组件)',
  diagnosis: '临床诊断信息 (~700组件)',
  medication: '检查与用药记录 (~700组件)',
}

watch(activeTab, (newTab, oldTab) => {
  if (oldTab === newTab || !oldTab) return
  switchCount.value++
  tabKey.value++
  const before = getMemoryInfo()
  takeSnapshot(`Tab切换: ${tabLabels[oldTab]}→${tabLabels[newTab]}`)
  setTimeout(() => {
    const after = getMemoryInfo()
    console.log(`[Tab切换] Heap: ${formatBytes(before.heapUsed)} → ${formatBytes(after.heapUsed)}, DOM: ${before.domCount} → ${after.domCount}`)
  }, 1500)
})

async function toggleForms() {
  const before = getMemoryInfo()
  const willDestroy = showForms.value
  const action = willDestroy ? '销毁' : '加载'
  takeSnapshot(`${action}前`)
  console.log(`[toggleForms] showForms=${showForms.value} → ${!showForms.value}`)

  showForms.value = !showForms.value
  tabKey.value++

  await nextTick()

  setTimeout(() => {
    const after = getMemoryInfo()
    takeSnapshot(`${action}后`)
    const delta = after.heapUsed - before.heapUsed
    const domDelta = after.domCount - before.domCount
    console.group(`%c[内存监测] ${action}表单`, 'color: #E6A23C; font-weight: bold')
    console.log(`Heap: ${formatBytes(before.heapUsed)} → ${formatBytes(after.heapUsed)} (${delta >= 0 ? '+' : ''}${formatBytes(delta)})`)
    console.log(`DOM: ${before.domCount} → ${after.domCount} (${domDelta >= 0 ? '+' : ''}${domDelta})`)

    if (!showForms.value) {
      const baseline = getSnapshotHistory().find(s => s.label === '页面初始化(无表单)')
      if (baseline) {
        const domLeak = after.domCount - baseline.domCount
        const heapLeak = after.heapUsed - baseline.heapUsed
        console.log(`与基线对比 - DOM: +${domLeak}, Heap: +${formatBytes(heapLeak)}`)
      }
    }
    console.groupEnd()
  }, 2000)
}

function switchMode(mode: 'element' | 'naive') {
  if (uiMode.value === mode) return
  if (showForms.value) { showForms.value = false; tabKey.value++ }
  uiMode.value = mode
}
</script>

<template>
  <div class="app-container">
    <MemoryMonitor :switch-count="switchCount" />

    <div class="toolbar">
      <div class="mode-switch">
        <button :class="['mode-btn', { active: uiMode === 'element' }]" @click="switchMode('element')">Element Plus</button>
        <button :class="['mode-btn', { active: uiMode === 'naive' }]" @click="switchMode('naive')">Naive UI</button>
      </div>
      <el-button :type="showForms ? 'danger' : 'success'" @click="toggleForms">
        {{ showForms ? '销毁所有表单' : '加载所有表单' }}
      </el-button>
      <span class="hint">UI: {{ uiMode }} | showForms={{ showForms }}</span>
    </div>

    <div class="simple-tabs">
      <button v-for="tab in ['patient', 'diagnosis', 'medication']" :key="tab"
        :class="['tab-btn', { active: activeTab === tab }]" @click="activeTab = tab">
        {{ tabLabels[tab] }}
      </button>
    </div>

    <div class="test-banner" v-if="showForms">🟢 表单可见</div>
    <div class="test-banner test-hidden" v-else>🔴 表单已销毁</div>

    <TabContainer v-if="uiMode === 'element' && showForms" :key="'el-' + tabKey" :active-tab="activeTab" :tab-key="tabKey" />
    <n-config-provider v-if="uiMode === 'naive' && showForms" :key="'naive-' + tabKey">
      <NaiveTabContainer :active-tab="activeTab" :tab-key="tabKey" />
    </n-config-provider>
  </div>
</template>

<style scoped>
.app-container { padding: 16px; max-width: 1400px; margin: 0 auto; }
.toolbar { margin: 12px 0; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.hint { font-size: 12px; color: #909399; }
.simple-tabs { display: flex; gap: 2px; margin-top: 12px; border-bottom: 2px solid #e4e7ed; }
.tab-btn { padding: 10px 20px; border: none; background: transparent; cursor: pointer; font-size: 13px; color: #606266; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.2s; }
.tab-btn:hover { color: #409EFF; }
.tab-btn.active { color: #409EFF; border-bottom-color: #409EFF; font-weight: 600; }
.mode-switch { display: inline-flex; border: 1px solid #dcdfe6; border-radius: 4px; overflow: hidden; }
.mode-btn { padding: 6px 14px; border: none; background: #fff; cursor: pointer; font-size: 12px; color: #606266; transition: all 0.2s; }
.mode-btn.active { background: #409EFF; color: #fff; }
.mode-btn:not(.active):hover { color: #409EFF; }
.test-banner { margin-top: 8px; padding: 8px 12px; border-radius: 4px; font-size: 13px; font-weight: 600; background: #e1f3d8; color: #67C23A; }
.test-banner.test-hidden { background: #fde2e2; color: #F56C6C; }
</style>
