<script setup lang="ts">
import { reactive } from 'vue'
import type { FormRule } from '../types'

const props = defineProps<{
  rules: FormRule[]
}>()

const formData = reactive<Record<string, any>>({})

// Initialize form data from rules
props.rules.forEach((r) => {
  if (r.field) {
    formData[r.field] = r.value ?? ''
  }
})
</script>

<template>
  <n-form :model="formData" label-placement="left" :label-width="100" size="small">
    <n-grid :cols="3" :x-gap="16" :y-gap="8">
      <n-form-item-gi
        v-for="rule in rules"
        :key="rule.field"
        :label="rule.title"
        :path="rule.field"
        :span="rule.props?.type === 'textarea' ? 3 : 1"
      >
        <!-- 文本输入框 -->
        <n-input
          v-if="rule.type === 'input' && rule.props?.type !== 'textarea'"
          v-model:value="formData[rule.field]"
          :placeholder="rule.props?.placeholder"
          :clearable="rule.props?.clearable"
        />
        <!-- 下拉选择框 -->
        <n-select
          v-else-if="rule.type === 'select'"
          v-model:value="formData[rule.field]"
          :placeholder="rule.props?.placeholder"
          :clearable="rule.props?.clearable"
          :options="rule.props?.options ?? []"
        />
        <!-- 多行文本域 -->
        <n-input
          v-else-if="rule.type === 'input' && rule.props?.type === 'textarea'"
          v-model:value="formData[rule.field]"
          type="textarea"
          :rows="rule.props?.rows ?? 2"
          :placeholder="rule.props?.placeholder"
        />
      </n-form-item-gi>
    </n-grid>
  </n-form>
</template>
