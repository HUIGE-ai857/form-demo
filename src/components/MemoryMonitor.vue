<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { formatBytes, takeSnapshot, getSnapshotHistory, calculateDelta } from '../utils/memoryUtils'
import { perfStore } from '../utils/store'

const props = defineProps<{
  switchCount: number
}>()

const heapUsed = ref(0)
const domCount = ref(0)
const snapshots = ref(getSnapshotHistory())

let interval: number | null = null

const recentSnapshots = computed(() => snapshots.value.slice(-6))

function refresh() {
  const mem = (performance as any).memory
  heapUsed.value = mem?.usedJSHeapSize ?? 0
  domCount.value = document.querySelectorAll('*').length
  snapshots.value = getSnapshotHistory()
}

function handleSnapshot() {
  takeSnapshot('手动快照')
  refresh()
}

onMounted(() => {
  refresh()
  interval = window.setInterval(refresh, 2000)
})

onUnmounted(() => {
  if (interval !== null) clearInterval(interval)
})
</script>

<template>
  <div class="monitor">
    <div class="stat">
      <span class="label">JS堆内存</span>
      <span class="value">{{ formatBytes(heapUsed) }}</span>
    </div>
    <div class="stat">
      <span class="label">DOM元素</span>
      <span class="value">{{ domCount.toLocaleString() }}</span>
    </div>
    <div class="stat">
      <span class="label">表单字段</span>
      <span class="value">{{ perfStore.totalFieldCount.toLocaleString() }}</span>
      <span class="sub">/ {{ perfStore.formGroupCount }}组</span>
    </div>
    <div class="stat">
      <span class="label">表格行</span>
      <span class="value">{{ perfStore.tableRowCount }}</span>
    </div>
    <div class="stat">
      <span class="label">切换次数</span>
      <span class="value warn">{{ switchCount }}</span>
    </div>

    <el-button size="small" type="primary" @click="handleSnapshot">记录快照</el-button>

    <div class="toolbar-hint">
      <span class="hint">提示：打开 Chrome DevTools → Memory → 拍堆快照对比</span>
    </div>

    <div class="snapshots" v-if="recentSnapshots.length > 0">
      <div class="snap-row" v-for="(s, i) in recentSnapshots" :key="i">
        <span class="snap-idx">#{{ i + 1 }}</span>
        <span class="snap-label">{{ s.label }}</span>
        <span class="snap-heap">{{ formatBytes(s.heapUsed) }}</span>
        <span class="snap-dom">{{ s.domCount }}节点</span>
        <span v-if="i > 0" :class="['snap-delta', s.heapUsed >= recentSnapshots[i - 1].heapUsed ? 'up' : 'down']">
          {{ calculateDelta(recentSnapshots[i - 1], s) }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.monitor {
  background: #1a1a2e;
  border-radius: 8px;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 13px;
}
.stat { display: flex; align-items: baseline; gap: 6px; }
.label { color: #8b8ba7; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
.value { color: #00d4aa; font-weight: bold; font-size: 15px; }
.value.warn { color: #e6a23c; }
.sub { color: #555; font-size: 11px; }
.toolbar-hint { width: 100%; margin-top: -8px; }
.hint { color: #555; font-size: 11px; }
.snapshots {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid #2a2a4e;
}
.snap-row { display: flex; gap: 8px; font-size: 11px; color: #8b8ba7; align-items: center; }
.snap-idx { color: #555; min-width: 24px; }
.snap-label { color: #409EFF; min-width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.snap-heap { color: #00d4aa; min-width: 80px; }
.snap-dom { color: #e6a23c; min-width: 80px; }
.snap-delta { font-size: 10px; }
.snap-delta.up { color: #f56c6c; }
.snap-delta.down { color: #67c23a; }
</style>
