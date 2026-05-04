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
const formApis = ref<any[]>([])
const tableColumns = getTableColumns('medication')
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
  formGroups.value = generateFormGroups('pat', GROUPS, ['input', 'select', 'textarea'], FIELDS_PER_GROUP)
  formApis.value = new Array(formGroups.value.length).fill(null)
  initTable()
  perfStore.totalFieldCount = totalFieldCount
  perfStore.formGroupCount = GROUPS
  perfStore.tableRowCount = tableRows.value.length * tableColumns.length
  takeSnapshot(`Tab1-患者信息`)
})

const rootRef = ref<HTMLElement | null>(null)

onBeforeUnmount(() => {
  preDestroyCleanup()
  // v4: 先 reset 再 destroy，再置空所有属性释放引用
  formApis.value.forEach(api => {
    if (!api) return
    try { api.reset() } catch (e) {}
    try { api.clearValidateState() } catch (e) {}
    try { api.destroy() } catch (e) {}
    try { Object.keys(api).forEach(k => { try { api[k] = null } catch (e) {} }) } catch (e) {}
  })
  // 深度置空 rules 数组中每个对象
  formGroups.value.forEach(group => {
    group.forEach(rule => { if (rule) try { Object.keys(rule).forEach(k => { try { (rule as any)[k] = null } catch (e) {} }) } catch (e) {} })
    try { group.length = 0 } catch (e) {}
  })
  // 置空表格数据
  tableRows.value.forEach(row => { if (row) try { Object.keys(row).forEach(k => { try { row[k] = null } catch (e) {} }) } catch (e) {} })
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
    <div class="form-section" v-for="(rules, idx) in formGroups" :key="'pat-' + idx">
      <div class="section-header">
        患者信息组 {{ idx + 1 }} - {{ rules.length }}个字段
      </div>
      <ElFormCreate :rule="rules" :option="formOption" v-model:api="formApis[idx]" />
    </div>

    <div class="table-section">
      <div class="section-header">既往用药记录 ({{ tableRows.length }}行 × {{ tableColumns.length }}列)</div>
      <InlineTable :columns="tableColumns" :rows="tableRows" @add="addRow" @remove="removeRow" />
    </div>
  </div>
</template>

<style scoped>
.tab-container { padding: 8px 0; }
.form-section { margin-bottom: 16px; border: 1px solid #e4e7ed; border-radius: 4px; padding: 12px; }
.section-header { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #409EFF; }
.table-section { margin-bottom: 16px; }
</style>
