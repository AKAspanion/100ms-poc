import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Split 100ms libraries into separate chunks
          if (id.includes('@100mslive/hms-video-store')) {
            return 'hms-video-store';
          }
          if (id.includes('@100mslive/hms-virtual-background')) {
            return 'hms-virtual-background';
          }
          // Split PrimeVue (including subpath imports) into its own chunk
          if (id.includes('primevue')) {
            return 'primevue';
          }
          // Split Vue Router into its own chunk
          if (id.includes('vue-router')) {
            return 'vue-router';
          }
          // Split Pinia into its own chunk
          if (id.includes('pinia')) {
            return 'pinia';
          }
          // Split node_modules into vendor chunk
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
