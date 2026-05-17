import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync, type ExecSyncOptions } from 'node:child_process'
import { readFileSync } from 'fs'
import { fileURLToPath, URL } from 'node:url'

// Read version and git info at build time
const getVersionInfo = () => {
  const repoRoot = fileURLToPath(new URL('..', import.meta.url))
  let version = '0.0.0'

  try {
    version = readFileSync(new URL('../VERSION', import.meta.url), 'utf-8').trim()
  } catch {
    version = '0.0.0'
  }

  const envBranch = process.env.GIT_BRANCH?.trim() || ''
  const envCommit = process.env.GIT_COMMIT?.trim() || ''
  if (envBranch || envCommit) {
    return { version, gitBranch: envBranch, gitCommit: envCommit }
  }

  try {
    const gitOptions: ExecSyncOptions = { cwd: repoRoot, stdio: ['ignore', 'pipe', 'ignore'] }
    const gitBranch = execSync('git rev-parse --abbrev-ref HEAD', gitOptions).toString().trim()
    const gitCommit = execSync('git rev-parse --short HEAD', gitOptions).toString().trim()
    return { version, gitBranch, gitCommit }
  } catch {
    return { version, gitBranch: '', gitCommit: '' }
  }
}

const { version, gitBranch, gitCommit } = getVersionInfo()

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // 确保只使用一个 React 副本，避免 "Invalid hook call" 错误
    dedupe: ['react', 'react-dom'],
  },

  define: {
    __APP_VERSION__: JSON.stringify(version),
    __GIT_BRANCH__: JSON.stringify(gitBranch),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
  },
  
  server: {
    port: 5173,
    // 配置开发服务器代理，将 /api 请求转发到 Rust 后端
    proxy: {
      '/api': {
        target: 'http://192.168.66.1:3000',
        changeOrigin: true,
        ws: true,
      }
    }
  },

  // 生产构建配置
  build: {
    // outDir: '../www',
    // emptyOutDir: true,
    rollupOptions: {
      output: {
        // 手动分包：将大型依赖分离
        manualChunks: {
          // React 核心
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // MUI 组件库
          'vendor-mui': ['@mui/material', '@mui/icons-material'],
          // MUI 图表
          'vendor-charts': ['@mui/x-charts'],
          // React Query
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
  },
})
