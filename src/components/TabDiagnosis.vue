<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import type { FormRule } from '../types'
import { generateFormGroups, getFormOption, getTableColumns, createEmptyRow } from '../utils/formSchemas'
import { perfStore } from '../utils/store'
import { takeSnapshot, preDestroyCleanup } from '../utils/memoryUtils'
import InlineTable from './InlineTable.vue'

const GROUPS = 10
const FIELDS_PER_GROUP = 20

const formOption = getFormOption()
const formGroups = ref<FormRule[][]>([])
const tableColumns = getTableColumns('diagnosis')
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
  formGroups.value = generateFormGroups('diag', GROUPS, ['input', 'select', 'textarea'], FIELDS_PER_GROUP)
  initTable()
  perfStore.totalFieldCount = totalFieldCount
  perfStore.formGroupCount = GROUPS
  perfStore.tableRowCount = tableRows.value.length * tableColumns.length
  takeSnapshot(`Tab2-临床诊断`)
})

const rootRef = ref<HTMLElement | null>(null)

onBeforeUnmount(() => {
  preDestroyCleanup()
  formGroups.value = []
  tableRows.value = []
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
    <div class="form-section" v-for="(rules, idx) in formGroups" :key="'diag-' + idx">
      <div class="section-header">诊断信息组 {{ idx + 1 }} - {{ rules.length }}个字段</div>
      <ElFormCreate :rule="rules" :option="formOption" />
    </div>

    <div class="table-section">
      <div class="section-header">诊断记录 ({{ tableRows.length }}行 × {{ tableColumns.length }}列)</div>
      <InlineTable :columns="tableColumns" :rows="tableRows" @add="addRow" @remove="removeRow" />
    </div>
  </div>
</template>

<style scoped>
.tab-container { padding: 8px 0; }
.form-section { margin-bottom: 16px; border: 1px solid #e4e7ed; border-radius: 4px; padding: 12px; }
.section-header { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #67C23A; }
.table-section { margin-bottom: 16px; }
</style>
