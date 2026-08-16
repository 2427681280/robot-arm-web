import { defineConfig } from 'vite'

export default defineConfig({
  // GitHub Pages 子路径部署（仓库 robot-arm-web）；本地 dev 不受影响
  base: '/robot-arm-web/',
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
  },
})
