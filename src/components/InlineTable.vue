<script setup lang="ts">
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

function handleRemove(index: number) {
  emit('remove', index)
}
</script>

<template>
  <div class="inline-table">
    <el-table :data="rows" border size="small" style="width: 100%">
      <el-table-column type="index" label="#" width="50" fixed />
      <el-table-column
        v-for="col in columns"
        :key="col.prop"
        :prop="col.prop"
        :label="col.label"
        :width="col.width"
      >
        <template #default="{ row }">
          <template v-if="col.type === 'select'">
            <el-select v-model="row[col.prop]" placeholder="请选择" size="small" style="width: 100%" :teleported="false">
              <el-option
                v-for="opt in col.options"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </template>
          <template v-else>
            <el-input v-model="row[col.prop]" placeholder="请输入" size="small" autocomplete="off" spellcheck="false" />
          </template>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="60" fixed="right">
        <template #default="{ $index }">
          <el-button text type="danger" size="small" @click="handleRemove($index)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="table-footer">
      <el-button size="small" type="primary" @click="handleAdd">+ 添加行</el-button>
    </div>
  </div>
</template>

<style scoped>
.inline-table {
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
