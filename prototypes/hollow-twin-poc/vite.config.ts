import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'node:child_process';

// The commit the build came from, shown in the 3D workstation's status bar ("unknown" outside git).
let commit = 'unknown';
try { commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* not a git checkout */ }

export default defineConfig({
  plugins: [react()],
  define: { __BUILD_COMMIT__: JSON.stringify(commit), __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
});
