import WASM from '@prisma/client/runtime/query_engine_bg.sqlite.wasm';
import { PrismaD1 } from '@prisma/adapter-d1';
import { createFetcher } from 'prisma-accelerate-local/workers';

export type Env = {
	SECRET: string;
} & {
	[key: string]: D1Database;
};

export default {
	fetch: createFetcher({
		queryEngineWasmModule: WASM,
		secret: (env: Env) => env.SECRET,
		runtime: () => require(`@prisma/client/runtime/query_engine_bg.sqlite.js`),
		adapter: (datasourceUrl: string, env) => {
			return new PrismaD1(env[datasourceUrl]);
		},
		singleInstance: false,
	}),
};
