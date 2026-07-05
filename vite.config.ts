import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	build: {
		sourcemap: true,
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: false,
				drop_debugger: false
			}
		}
	},
	esbuild: {
		keepNames: true,
		drop: []
	}
});
