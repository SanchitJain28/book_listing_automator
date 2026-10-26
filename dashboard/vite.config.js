import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { projectFilesPlugin } from './server/projectFiles.js';

export default defineConfig({ plugins: [react(), projectFilesPlugin(fileURLToPath(new URL('../', import.meta.url)))] });
