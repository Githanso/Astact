import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Not: AI Studio'dan kalan GEMINI_API_KEY / API_KEY define'lari kaldirildi;
// oyun bu degiskenleri kullanmiyordu, build'de undefined'a donusuyorlardi.
export default defineConfig({
  plugins: [react()],
  build: {
    // Cikti dogrudan Worker'in servis ettigi klasore yaziliyor.
    // emptyOutDir: false -> public/game_music.mp3 silinmesin.
    outDir: '../public',
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
