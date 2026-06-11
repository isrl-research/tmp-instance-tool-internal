import adapter from '@sveltejs/adapter-static';

export default {
	compilerOptions: {
		runes: ({ filename }) =>
			filename.split(/[/\\]/).includes('node_modules') ? undefined : true
	},
	kit: {
		adapter: adapter({ fallback: '404.html' }),
		paths: {
			base: process.env.BASE_PATH ?? ''
		}
	}
};
