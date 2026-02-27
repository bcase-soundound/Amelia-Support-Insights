
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Use (process as any) to avoid TS error if Node types are not detected in the environment
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    base: './', // Use relative paths for assets to support deployment in subdirectories (like GitHub Pages)
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})
