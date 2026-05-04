<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import type { FormRule } from '../types'
import { generateFormGroups, getFormOption, getTableColumns, createEmptyRow } from '../utils/formSchemas'
import { perfStore } from '../utils/store'
import { takeSnapshot, preDestroyCleanup } from '../utils/memoryUtils'
import NaiveInlineTable from './NaiveInlineTable.vue'

const GROUPS = 10
const FIELDS_PER_GROUP = 20

const formOption = getFormOption()
const formGroups = ref<FormRule[][]>([])
const formApis = ref<any[]>([])
const tableColumns = getTableColumns('exam')
const tableRows = ref<Record<string, any>[]>([])

const totalFieldCount = GROUPS * 3 * FIELDS_PER_GROUP

function initTable() {
  tableRows.value = Array.from({ length: 20 }, () => createEmptyRow(tableColumns))
}

function addRow() {
  tableRows.value.push(createEmptyRow(tableColumns))
}

function removeRow(index: number) {
  tableRows.value.splice(index, 1)
}

onMounted(() => {
  formGroups.value = generateFormGroups('n-med', GROUPS, ['input', 'select', 'textarea'], FIELDS_PER_GROUP)
  formApis.value = new Array(formGroups.value.length).fill(null)
  initTable()
  perfStore.totalFieldCount = totalFieldCount
  perfStore.formGroupCount = GROUPS
  perfStore.tableRowCount = tableRows.value.length * tableColumns.length
  takeSnapshot('Naive-Tab3-检查用药')
})

const rootRef = ref<HTMLElement | null>(null)

onBeforeUnmount(() => {
  preDestroyCleanup()
  formApis.value.forEach(api => {
    if (!api) return
    try { api.reset() } catch (e) {}
    try { api.clearValidateState() } catch (e) {}
    try { api.destroy() } catch (e) {}
  })
  formApis.value.length = 0
  formGroups.value.length = 0
  tableRows.value.length = 0
  if (rootRef.value) {
    rootRef.value.innerHTML = ''
  }
})

onUnmounted(() => {
  perfStore.totalFieldCount = 0
  perfStore.formGroupCount = 0
  perfStore.tableRowCount = 0
})
</script>

<template>
  <div ref="rootRef" class="tab-container">
    <div class="form-section" v-for="(rules, idx) in formGroups" :key="'n-med-' + idx">
      <div class="section-header">检查检验组 {{ idx + 1 }} - {{ rules.length }}个字段</div>
      <NaiveFormCreate :rule="rules" :option="formOption" v-model:api="formApis[idx]" />
    </div>

    <div class="table-section">
      <div class="section-header">检验检查记录 ({{ tableRows.length }}行 × {{ tableColumns.length }}列)</div>
      <NaiveInlineTable :columns="tableColumns" :rows="tableRows" @add="addRow" @remove="removeRow" />
    </div>
  </div>
</template>

<style scoped>
.tab-container { padding: 8px 0; }
.form-section { margin-bottom: 16px; border: 1px solid #e4e7ed; border-radius: 4px; padding: 12px; }
.section-header { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #f0a020; }
.table-section { margin-bottom: 16px; }
</style>
