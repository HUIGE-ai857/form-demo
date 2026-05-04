<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import NaiveTabPatient from './NaiveTabPatient.vue'
import NaiveTabDiagnosis from './NaiveTabDiagnosis.vue'
import NaiveTabMedication from './NaiveTabMedication.vue'
import { takeSnapshot } from '../utils/memoryUtils'

defineProps<{
  activeTab: string
  tabKey: number
}>()

onMounted(() => {
  takeSnapshot('Naive-TabContainer 挂载')
})

onUnmounted(() => {
  takeSnapshot('Naive-TabContainer 卸载')
})
</script>

<template>
  <div class="tab-content">
    <NaiveTabPatient v-if="activeTab === 'patient'" :key="'n-pat-' + tabKey" />
    <NaiveTabDiagnosis v-if="activeTab === 'diagnosis'" :key="'n-diag-' + tabKey" />
    <NaiveTabMedication v-if="activeTab === 'medication'" :key="'n-med-' + tabKey" />
  </div>
</template>

<style scoped>
.tab-content {
  margin-top: 16px;
  min-height: 400px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 16px;
}
</style>
