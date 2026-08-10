/*
 * @Author: zhp131468 249799138@qq.com
 * @Date: 2026-07-24 14:39:58
 * @LastEditors: zhp131468 249799138@qq.com
 * @LastEditTime: 2026-07-28 16:24:26
 * @Description: 文件描述
 * @FilePath: \vue3+AI+Demo\ai-chat-demo\vite.config.ts
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    // 使用ip能访问,也可以指定服务器主机名
    host: true,
    port: 8088,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: path => path
      }
    }
  }
})
