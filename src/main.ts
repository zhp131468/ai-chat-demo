/*
 * @Author: zhp131468 249799138@qq.com
 * @Date: 2026-07-24 14:39:58
 * @LastEditors: zhp131468 249799138@qq.com
 * @LastEditTime: 2026-07-24 14:53:44
 * @Description: 文件描述
 * @FilePath: \ai-chat-demo\src\main.ts
 */
import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
const app = createApp(App)
app.use(ElementPlus)
app.mount('#app')
