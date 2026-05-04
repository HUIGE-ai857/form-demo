<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import TabPatient from './TabPatient.vue'
import TabDiagnosis from './TabDiagnosis.vue'
import TabMedication from './TabMedication.vue'
import { takeSnapshot } from '../utils/memoryUtils'

defineProps<{
  activeTab: string
  tabKey: number
}>()

onMounted(() => {
  takeSnapshot('TabContainer 挂载')
})

onUnmounted(() => {
  takeSnapshot('TabContainer 卸载')
})
</script>

<template>
  <div class="tab-content">
    <TabPatient v-if="activeTab === 'patient'" :key="'pat-' + tabKey" />
    <TabDiagnosis v-if="activeTab === 'diagnosis'" :key="'diag-' + tabKey" />
    <TabMedication v-if="activeTab === 'medication'" :key="'med-' + tabKey" />
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
