import type { Ref } from 'vue'

export interface FormRule {
  type: string
  field: string
  title: string
  value: any
  props?: Record<string, any>
  validate?: Record<string, any>[]
  children?: FormRule[]
  effect?: Record<string, any>
  col?: Record<string, any>
}

export interface MemorySnapshot {
  heapUsed: number
  heapTotal: number
  heapLimit: number
  domCount: number
  timestamp: number
  label: string
}

export interface TableColumnDef {
  prop: string
  label: string
  type: 'input' | 'select'
  options?: { value: string; label: string }[]
  width?: string
}
