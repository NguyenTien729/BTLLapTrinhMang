import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
<<<<<<< HEAD
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({ plugins: [react(), tailwindcss()], server: { host: '0.0.0.0', proxy: {
  '/api': 'http://127.0.0.1:5000', '/uploads': 'http://127.0.0.1:5000',
  '/socket.io': { target:'http://127.0.0.1:5000', ws:true },
} } });
=======

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
});
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
