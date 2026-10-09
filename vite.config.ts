import { defineConfig } from 'vite';
import { webPwaPlugin } from './scripts/web-pwa-plugin.mjs';

export default defineConfig({ plugins: [webPwaPlugin()] });
