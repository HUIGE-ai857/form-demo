import type { FormRule, TableColumnDef } from '../types'

function createField(type: string, prefix: string, groupIdx: number, fieldIdx: number): FormRule {
  const idx = groupIdx * 20 + fieldIdx
  const field = `${prefix}_${type}_${idx}`

  switch (type) {
    case 'input': {
      const labels = ['姓名', '编号', '电话', '年龄', '床位号', '证件号', '住院号', '联系人', '邮箱', '科室',
        '病案号', '体温', '脉搏', '呼吸', '血压', '体重', '身高', '血氧', '疼痛评分', '过敏标记']
      const label = labels[fieldIdx % labels.length]
      return {
        type: 'input',
        field,
        title: `${label} ${idx + 1}`,
        value: '',
        props: { placeholder: `请输入${label}`, clearable: true },
      }
    }
    case 'select': {
      const labels = ['性别', '病情', '科室', '治疗结果', '过敏史', '既往史', '医保类型', '血型', '职业', '婚姻',
        '民族', '国籍', '意识状态', '自理能力', '营养风险', '疼痛程度', '教育程度', '支付方式', '就诊类型', '转归']
      const label = labels[fieldIdx % labels.length]
      return {
        type: 'select',
        field,
        title: `${label} ${idx + 1}`,
        value: '',
        props: {
          placeholder: `请选择${label}`,
          clearable: true,
          teleported: false,
          options: getOptions(fieldIdx),
        },
      }
    }
    case 'textarea': {
      const labels = ['症状描述', '诊断意见', '治疗方案', '备注信息', '出院小结', '检查所见', '化验结果',
        '医嘱内容', '病程记录', '转科说明', '手术记录', '麻醉记录', '护理记录', '康复计划', '随访记录',
        '用药说明', '饮食指导', '健康宣教', '风险告知', '知情同意']
      const label = labels[fieldIdx % labels.length]
      return {
        type: 'input',
        field,
        title: `${label} ${idx + 1}`,
        value: '',
        props: {
          type: 'textarea',
          rows: 2,
          placeholder: `请输入${label}`,
        },
      }
    }
    default:
      return { type: 'input', field, title: `字段 ${idx + 1}`, value: '', props: {} }
  }
}

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

function getOptions(index: number) {
  return OPTIONS_POOL[index % OPTIONS_POOL.length]
}

export function generateFormGroups(
  prefix: string,
  groups: number,
  types: ('input' | 'select' | 'textarea')[] = ['input', 'select', 'textarea'],
  fieldsPerGroup: number = 20
): FormRule[][] {
  const result: FormRule[][] = []
  for (let g = 0; g < groups; g++) {
    const rules: FormRule[] = []
    for (const type of types) {
      for (let f = 0; f < fieldsPerGroup; f++) {
        rules.push(createField(type, `${prefix}_g${g}`, g, f))
      }
    }
    result.push(rules)
  }
  return result
}

export function getFormOption() {
  return {
    form: {
      labelWidth: '100px',
      size: 'small',
    },
    submitBtn: false,
    resetBtn: false,
  }
}

const TABLE_TEMPLATES: Record<string, TableColumnDef[]> = {
  medication: [
    { prop: 'drugName', label: '药品名称', type: 'input', width: '150' },
    { prop: 'dosage', label: '剂量', type: 'input', width: '80' },
    { prop: 'unit', label: '单位', type: 'select', options: [{ value: 'mg', label: 'mg' }, { value: 'g', label: 'g' }, { value: 'ml', label: 'ml' }], width: '70' },
    { prop: 'frequency', label: '频次', type: 'select', options: [{ value: 'qd', label: 'QD' }, { value: 'bid', label: 'BID' }, { value: 'tid', label: 'TID' }, { value: 'qid', label: 'QID' }], width: '90' },
    { prop: 'route', label: '途径', type: 'select', options: [{ value: 'po', label: '口服' }, { value: 'iv', label: '静脉' }, { value: 'im', label: '肌注' }, { value: 'sc', label: '皮下' }], width: '80' },
  ],
  exam: [
    { prop: 'itemName', label: '检查项目', type: 'input', width: '150' },
    { prop: 'result', label: '结果', type: 'input', width: '100' },
    { prop: 'unit', label: '单位', type: 'input', width: '70' },
    { prop: 'range', label: '参考范围', type: 'input', width: '120' },
    { prop: 'abnormal', label: '异常', type: 'select', options: [{ value: 'n', label: '正常' }, { value: 'y', label: '异常' }], width: '70' },
  ],
  diagnosis: [
    { prop: 'diseaseName', label: '诊断名称', type: 'input', width: '160' },
    { prop: 'code', label: '编码', type: 'input', width: '100' },
    { prop: 'type', label: '诊断类型', type: 'select', options: [{ value: 'main', label: '主要诊断' }, { value: 'complication', label: '并发症' }, { value: 'comorbidity', label: '合并症' }], width: '110' },
    { prop: 'date', label: '确诊日期', type: 'input', width: '110' },
    { prop: 'status', label: '状态', type: 'select', options: [{ value: 'active', label: '活动期' }, { value: 'remission', label: '缓解期' }, { value: 'cured', label: '已治愈' }], width: '90' },
  ],
}

export function getTableColumns(templateName: string): TableColumnDef[] {
  return TABLE_TEMPLATES[templateName] || TABLE_TEMPLATES.medication
}

export function createEmptyRow(columns: TableColumnDef[]): Record<string, any> {
  const row: Record<string, any> = {}
  columns.forEach((col) => (row[col.prop] = ''))
  return row
}
