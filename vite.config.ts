import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import devtoolsJson from 'vite-plugin-devtools-json';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';

const MOCK_PLUGIN_PATH = resolve(process.cwd(), 'scripts', '_mock-session-plugin.js');

async function loadMockPlugin(): Promise<Plugin[]> {
	if (process.env.MOCK_SESSION !== 'true') return [];
	if (!existsSync(MOCK_PLUGIN_PATH)) return [];
	try {
		const pluginUrl = pathToFileURL(MOCK_PLUGIN_PATH).href;
		const { default: mockSessionPlugin } = (await import(pluginUrl)) as {
			default: () => Plugin;
		};
		return [mockSessionPlugin()];
	} catch {
		return [];
	}
}

export default defineConfig(async () => ({
	plugins: [tailwindcss(), sveltekit(), devtoolsJson(), ...(await loadMockPlugin())]
}));
