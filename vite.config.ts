import { defineConfig } from 'vite';

// Relative asset paths so the build works at a site root or under a
// sub-path such as https://<user>.github.io/power-hour/.
export default defineConfig({
  base: './',
});
