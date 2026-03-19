import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		alias: {
			'@/*': './src/lib/*'
		},
		adapter: adapter(),
		csrf: {
			trustedOrigins: ['https://shib.oit.duke.edu']
		}
	}
};

export default config;
