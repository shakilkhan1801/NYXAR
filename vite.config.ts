import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), basicSsl()],
  clearScreen: false,
  build: {
    sourcemap: false,
  },
  server: {
    host: '0.0.0.0', // Expose to network
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000', 
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000', 
        changeOrigin: true,
        ws: true,
        secure: false,
      },
    },
  },
});