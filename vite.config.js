import { defineConfig } from 'vite';

// es2022 for top-level await (data loads before the app boots)
export default defineConfig({
  build: { target: 'es2022' },
});
