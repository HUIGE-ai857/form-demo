<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, onUnmounted } from 'vue'
import { perfStore } from '../utils/store'
import { takeSnapshot, preDestroyCleanup } from '../utils/memoryUtils'
import NaiveInlineTable from './NaiveInlineTable.vue'

const GROUPS = 10
const FIELDS_PER_GROUP = 20

interface FieldDef {
  type: 'input' | 'select' | 'textarea'
  field: string
  label: string
  options?: { value: string; label: string }[]
}

const formData = ref<Record<string, any>>({})
const groups = shallowRef<FieldDef[][]>([])
const tableColumns = [
  { prop: 'drugName', label: '药品名称', type: 'input' as const, width: '150' },
  { prop: 'dosage', label: '剂量', type: 'input' as const, width: '80' },
  { prop: 'unit', label: '单位', type: 'select' as const, options: [{ value: 'mg', label: 'mg' }, { value: 'g', label: 'g' }, { value: 'ml', label: 'ml' }], width: '70' },
  { prop: 'frequency', label: '频次', type: 'select' as const, options: [{ value: 'qd', label: 'QD' }, { value: 'bid', label: 'BID' }, { value: 'tid', label: 'TID' }, { value: 'qid', label: 'QID' }], width: '90' },
  { prop: 'route', label: '途径', type: 'select' as const, options: [{ value: 'po', label: '口服' }, { value: 'iv', label: '静脉' }, { value: 'im', label: '肌注' }, { value: 'sc', label: '皮下' }], width: '80' },
]
const tableRows = ref<Record<string, any>[]>([])

const rootRef = ref<HTMLElement | null>(null)
const totalFieldCount = GROUPS * 3 * FIELDS_PER_GROUP

const OPTIONS_POOL = [
  [{ value: 'male', label: '男' }, { value: 'female', label: '女' }],
  [{ value: 'mild', label: '轻度' }, { value: 'moderate', label: '中度' }, { value: 'severe', label: '重度' }, { value: 'critical', label: '危重' }],
  [{ value: 'internal', label: '内科' }, { value: 'surgical', label: '外科' }, { value: 'pediatrics', label: '儿科' }, { value: 'gynecology', label: '妇科' }, { value: 'ent', label: '耳鼻喉科' }],
  [{ value: 'cured', label: '治愈' }, { value: 'improved', label: '好转' }, { value: 'uncured', label: '未愈' }, { value: 'died', label: '死亡' }],
  [{ value: 'yes', label: '有' }, { value: 'no', label: '无' }, { value: 'unknown', label: '不详' }],
  [{ value: 'urban', label: '城镇职工' }, { value: 'rural', label: '城乡居民' }, { value: 'commercial', label: '商业保险' }, { value: 'selfpay', label: '自费' }],
  [{ value: 'a', label: 'A型' }, { value: 'b', label: 'B型' }, { value: 'o', label: 'O型' }, { value: 'ab', label: 'AB型' }],
  [{ value: 'married', label: '已婚' }, { value: 'unmarried', label: '未婚' }, { value: 'divorced', label: '离异' }],
  [{ value: 'alert', label: '清醒' }, { value: 'confused', label: '模糊' }, { value: 'stupor', label: '昏睡' }, { value: 'coma', label: '昏迷' }],
  [{ value: 'full', label: '完全自理' }, { value: 'partial', label: '部分自理' }, { value: 'none', label: '不能自理' }],
]

const INPUT_LABELS = ['姓名', '编号', '电话', '年龄', '床位号', '证件号', '住院号', '联系人', '邮箱', '科室',
  '病案号', '体温', '脉搏', '呼吸', '血压', '体重', '身高', '血氧', '疼痛评分', '过敏标记']
const SELECT_LABELS = ['性别', '病情', '科室', '治疗结果', '过敏史', '既往史', '医保类型', '血型', '职业', '婚姻',
  '民族', '国籍', '意识状态', '自理能力', '营养风险', '疼痛程度', '教育程度', '支付方式', '就诊类型', '转归']
const TEXTAREA_LABELS = ['症状描述', '诊断意见', '治疗方案', '备注信息', '出院小结', '检查所见', '化验结果',
  '医嘱内容', '病程记录', '转科说明', '手术记录', '麻醉记录', '护理记录', '康复计划', '随访记录',
  '用药说明', '饮食指导', '健康宣教', '风险告知', '知情同意']

function generateField(prefix: string, groupIdx: number, fieldIdx: number, type: string): FieldDef {
  const idx = groupIdx * 20 + fieldIdx
  const field = `${prefix}_${type}_${idx}`
  if (type === 'select') {
    const label = SELECT_LABELS[fieldIdx % SELECT_LABELS.length]
    return { type: 'select', field, label: `${label} ${idx + 1}`, options: OPTIONS_POOL[fieldIdx % OPTIONS_POOL.length] }
  }
  if (type === 'textarea') {
    const label = TEXTAREA_LABELS[fieldIdx % TEXTAREA_LABELS.length]
    return { type: 'textarea', field, label: `${label} ${idx + 1}` }
  }
  const label = INPUT_LABELS[fieldIdx % INPUT_LABELS.length]
  return { type: 'input', field, label: `${label} ${idx + 1}` }
}

function initTable() {
  tableRows.value = Array.from({ length: 20 }, () => {
    const row: Record<string, any> = {}
    tableColumns.forEach(c => { row[c.prop] = '' })
    return row
  })
}

function addRow() { tableRows.value.push(Object.fromEntries(tableColumns.map(c => [c.prop, '']))) }
function removeRow(index: number) { tableRows.value.splice(index, 1) }

onMounted(() => {
  const result: FieldDef[][] = []
  const data: Record<string, any> = {}
  for (let g = 0; g < GROUPS; g++) {
    const fields: FieldDef[] = []
    for (const type of ['input', 'select', 'textarea']) {
      for (let f = 0; f < FIELDS_PER_GROUP; f++) {
        const field = generateField('nn', g, f, type)
        fields.push(field)
        data[field.field] = ''
      }
    }
    result.push(fields)
  }
  formData.value = data
  groups.value = result
  initTable()
  perfStore.totalFieldCount = totalFieldCount
  perfStore.formGroupCount = GROUPS
  perfStore.tableRowCount = tableRows.value.length * tableColumns.length
  takeSnapshot('NativeNaive-加载完成')
})

onBeforeUnmount(() => {
  preDestroyCleanup()
  formData.value = {}
  groups.value = []
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
    <div class="section" v-for="(fields, idx) in groups" :key="'nn-g-' + idx">
      <div class="section-header" style="border-bottom-color: #18a058;">原生 Naive 组件组 {{ idx + 1 }} - {{ fields.length }}个字段</div>
      <n-form label-placement="left" :label-width="100" size="small">
        <n-grid :cols="3" :x-gap="16" :y-gap="8">
          <n-form-item-gi v-for="f in fields" :key="f.field" :label="f.label" :span="f.type === 'textarea' ? 3 : 1">
            <n-input
              v-if="f.type === 'input'"
              v-model:value="formData[f.field]"
              :placeholder="'请输入' + f.label"
              clearable
            />
            <n-select
              v-else-if="f.type === 'select'"
              v-model:value="formData[f.field]"
              :placeholder="'请选择' + f.label"
              :options="f.options ?? []"
              clearable
            />
            <n-input
              v-else-if="f.type === 'textarea'"
              v-model:value="formData[f.field]"
              type="textarea"
              :rows="2"
              :placeholder="'请输入' + f.label"
            />
          </n-form-item-gi>
        </n-grid>
      </n-form>
    </div>

    <div class="table-section">
      <div class="section-header" style="border-bottom-color: #18a058;">原生 Naive 表格 ({{ tableRows.length }}行 × {{ tableColumns.length }}列)</div>
      <NaiveInlineTable :columns="tableColumns" :rows="tableRows" @add="addRow" @remove="removeRow" />
    </div>
  </div>
</template>

<style scoped>
.tab-container { padding: 8px 0; }
.section { margin-bottom: 16px; border: 1px solid #e4e7ed; border-radius: 4px; padding: 12px; }
.section-header { font-size: 14px; font-weight: 600; color: #303133; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #409EFF; }
.table-section { margin-bottom: 16px; }
</style>
