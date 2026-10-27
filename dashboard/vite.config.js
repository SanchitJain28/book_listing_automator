import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { projectFilesPlugin } from './server/projectFiles.js';
import { vpsStatusPlugin } from './server/vpsStatus.js';

const root = fileURLToPath(new URL('../', import.meta.url));
export default defineConfig({ plugins: [react(), projectFilesPlugin(root), vpsStatusPlugin(root)] });
