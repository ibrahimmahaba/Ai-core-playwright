import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'


export default defineConfig(({mode}) => {
  const env = loadEnv(mode, process.cwd(), "")
  return {
    plugins: [react()],
    base: './',
    build: {
      outDir: '../portals'
    },
    define: {
      'process.env.MODULE': JSON.stringify(env.MODULE),
      'process.env.ENDPOINT': JSON.stringify(env.ENDPOINT),
      'process.env.APP': JSON.stringify(env.APP)
    },
    server: {
			port: 5173,
			proxy: {
				[env.MODULE]: {
					target: env.ENDPOINT,
					changeOrigin: true,
					secure: false,
					preserveHeaderKeyCase: true,
				},
			},
		}
  }
  
});
