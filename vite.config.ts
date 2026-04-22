import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({ mode }) => {
  // 1. 환경 변수 로드
  const env = loadEnv(mode, process.cwd(), '');

  return {
    // 2. 깃허브 페이지 배포를 위한 베이스 경로 설정 (AI Studio 미리보기 환경에서는 '/' 사용)
    base: process.env.GITHUB_ACTIONS ? '/jb-golf-admin/' : '/', 
    
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@shared': path.resolve(__dirname, './src/shared'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          srchView: path.resolve(__dirname, 'srch-view.html')
        }
      }
    }
  };
});