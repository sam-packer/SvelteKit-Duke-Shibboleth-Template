import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

async function loadMockPlugin(): Promise<Plugin[]> {
	if (process.env.MOCK_SESSION !== 'true') return [];
	try {
		const { default: mockSessionPlugin } = await import('./scripts/_mock-session-plugin.js');
		return [mockSessionPlugin()];
	} catch {
		return [];
	}
}

export default defineConfig(async () => ({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson(), ...(await loadMockPlugin())]
}));
