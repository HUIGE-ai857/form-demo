<script setup lang="ts">
import { h, reactive } from 'vue'
import type { DataTableColumn } from 'naive-ui'
import type { TableColumnDef } from '../types'
import { createEmptyRow } from '../utils/formSchemas'

const props = defineProps<{
  columns: TableColumnDef[]
  rows: Record<string, any>[]
}>()

const emit = defineEmits<{
  add: []
  remove: [index: number]
}>()

function handleAdd() {
  emit('add')
}

function handleRemove(_: any, index: number) {
  emit('remove', index)
}

const tableColumns: DataTableColumn[] = props.columns.map((col) => ({
  title: col.label,
  key: col.prop,
  width: col.width ? Number(col.width) : undefined,
  render(row: Record<string, any>, index: number) {
    if (col.type === 'select') {
      return h('n-select', {
        value: row[col.prop],
        'onUpdate:value': (v: any) => { row[col.prop] = v },
        placeholder: '请选择',
        size: 'small',
        options: col.options,
        style: 'width: 100%',
      })
    }
    return h('n-input', {
      value: row[col.prop],
      'onUpdate:value': (v: any) => { row[col.prop] = v },
      placeholder: '请输入',
      size: 'small',
    })
  },
}))

tableColumns.push({
  title: '操作',
  key: '__action',
  width: 60,
  render(_row: any, index: number) {
    return h('n-button', {
      text: true,
      type: 'error',
      size: 'small',
      onClick: () => handleRemove(null, index),
    }, { default: () => '删除' })
  },
})
</script>

<template>
  <div class="naive-table">
    <n-data-table
      :columns="tableColumns"
      :data="rows"
      :bordered="true"
      :single-line="false"
      size="small"
    />
    <div class="table-footer">
      <n-button size="small" type="primary" @click="handleAdd">+ 添加行</n-button>
    </div>
  </div>
</template>

<style scoped>
.naive-table {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  overflow: hidden;
}
.table-footer {
  padding: 8px 12px;
  background: #fafafa;
  border-top: 1px solid #e4e7ed;
}
</style>
