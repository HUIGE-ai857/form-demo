<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import type { FormRule } from '../types'
import { generateFormGroups, getFormOption, getTableColumns, createEmptyRow } from '../utils/formSchemas'
import { perfStore } from '../utils/store'
import { takeSnapshot, preDestroyCleanup } from '../utils/memoryUtils'
import NaiveInlineTable from './NaiveInlineTable.vue'

const GROUPS = 10
const FIELDS_PER_GROUP = 20

const formOption = getFormOption()
const formGroups = shallowRef<FormRule[][]>([])
const formApis = ref<any[]>([])
const tableColumns = getTableColumns('medication')
const tableRows = ref<Record<string, any>[]>([])

const totalFieldCount = GROUPS * 8 * FIELDS_PER_GROUP

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
  formGroups.value = generateFormGroups('n-pat', GROUPS, ['input', 'select', 'textarea', 'datePicker', 'dateTimePicker', 'yearPicker', 'monthPicker', 'timePicker'], FIELDS_PER_GROUP)
  formApis.value = new Array(formGroups.value.length).fill(null)
  initTable()
  perfStore.totalFieldCount = totalFieldCount
  perfStore.formGroupCount = GROUPS
  perfStore.tableRowCount = tableRows.value.length * tableColumns.length
  takeSnapshot('Naive-Tab1-患者信息')
})

onBeforeUnmount(() => {
  preDestroyCleanup()
  formApis.value.length = 0
  formGroups.value = []
  tableRows.value.length = 0
})

onUnmounted(() => {
  perfStore.totalFieldCount = 0
  perfStore.formGroupCount = 0
  perfStore.tableRowCount = 0
})
</script>

<template>
  <div class="tab-container">
    <div class="form-section" v-for="(rules, idx) in formGroups" :key="'n-pat-' + idx">
      <div class="section-header" style="border-bottom-color: #18a058;">患者信息组 {{ idx + 1 }} - {{ rules.length }}个字段</div>
      <NaiveFormCreate :rule="rules" :option="formOption" v-model:api="formApis[idx]" />
    </div>

    <div class="table-section">
      <div class="section-header" style="border-bottom-color: #18a058;">既往用药记录 ({{ tableRows.length }}行 × {{ tableColumns.length }}列)</div>
      <NaiveInlineTable :columns="tableColumns" :rows="tableRows" @add="addRow" @remove="removeRow" />
    </div>
  </div>
</template>

<style scoped>
.tab-container { padding: 8px 0; }
.form-section { margin-bottom: 16px; border: 1px solid #e4e7ed; border-radius: 4px; padding: 12px; }
.section-header { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #409EFF; }
.table-section { margin-bottom: 16px; }
</style>
