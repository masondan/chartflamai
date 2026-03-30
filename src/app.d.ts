// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env: {
				PERPLEXITY_API_KEY: string;
				OPENAI_API_KEY: string;
			};
		}
	}
}

export {};
