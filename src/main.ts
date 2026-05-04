import { createApp } from 'vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import NaiveUI from 'naive-ui'
import elementFormCreate from '@form-create/element-ui'
import naiveFormCreate from '@form-create/naive-ui'
import App from './App.vue'

const app = createApp(App)
app.use(ElementPlus)
app.use(NaiveUI)

// 1. 先注册 Element Plus 版本的 form-create
app.use(elementFormCreate)
const ElFormCreate = app.component('FormCreate')

// 2. 再注册 Naive UI 版本的 form-create（会覆盖 <form-create> 组件）
app.use(naiveFormCreate)
const NaiveFormCreate = app.component('FormCreate')

// 3. 将两个版本的 form-create 注册为不同名称，供 template 按需使用
app.component('ElFormCreate', ElFormCreate)
app.component('NaiveFormCreate', NaiveFormCreate)

app.mount('#app')
