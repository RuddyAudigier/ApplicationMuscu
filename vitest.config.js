import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.js'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./tests/setup.js'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html', 'lcov'],
        exclude: [
          'node_modules/',
          'tests/',
          '**/*.test.js',
          '**/*.spec.js',
          'dist/',
          '.stryker-tmp/',
          'coverage/',
          'src/App.jsx',
          'src/**/*.css',
          'src/main.jsx',
          'src/registerServiceWorker.js',
          'src/supabase.js',
          'src/components/**',
          'src/pages/**',
          'src/services/supabaseService.js',
          'src/services/index.js',
          'src/utils/baselinePerformances.js',
          'src/utils/e1rm.js',
          'android/**',
          'public/**',
          '*.config.js',
          '*.config.ts',
          '*.config.mjs'
        ]
      },
      include: ['tests/**/*.test.js']
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    }
  })
)
