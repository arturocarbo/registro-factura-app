import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: {
        name: 'Registro Factura - SAP Connect',
        short_name: 'Facturas SAP',
        description: 'App de gastos y escaneo de facturas para SAP',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=192',
            sizes: '192x192',
            type: 'image/jpeg'
          },
          {
            src: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=512',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      }
    })
  ],
});
