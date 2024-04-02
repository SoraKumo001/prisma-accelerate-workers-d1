import WASM from '@prisma/client/runtime/query_engine_bg.sqlite.wasm';
import { PrismaAccelerate, PrismaAccelerateConfig, ResultError } from 'prisma-accelerate-local/lib';
import { getPrismaClient } from '@prisma/client/runtime/wasm.js';
import { PrismaD1 } from '@prisma/adapter-d1';

export type Env = {
	SECRET: string;
	KV: KVNamespace;
} & {
	[key: string]: D1Database;
};

const getAdapter = (db: D1Database) => {
	return new PrismaD1(db);
};

let prismaAccelerate: PrismaAccelerate;
const getPrismaAccelerate = async ({
	env,
	secret,
	onRequestSchema,
	onChangeSchema,
}: {
	env: Env;
	secret: string;
	onRequestSchema: PrismaAccelerateConfig['onRequestSchema'];
	onChangeSchema: PrismaAccelerateConfig['onChangeSchema'];
}) => {
	if (prismaAccelerate) {
		return prismaAccelerate;
	}
	prismaAccelerate = new PrismaAccelerate({
		singleInstance: true,
		secret,
		adapter: (datasourceUrl) => getAdapter(env[datasourceUrl]),
		getRuntime: () => require(`@prisma/client/runtime/query_engine_bg.sqlite.js`),
		getQueryEngineWasmModule: async () => {
			return WASM;
		},
		getPrismaClient,
		onRequestSchema,
		onChangeSchema,
	});
	return prismaAccelerate;
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const prismaAccelerate = await getPrismaAccelerate({
			env,
			secret: env.SECRET ?? 'test',
			onRequestSchema: ({ engineVersion, hash, datasourceUrl }) => {
				return env.KV.get(`schema-${engineVersion}:${hash}:${datasourceUrl}`);
			},
			onChangeSchema: ({ inlineSchema, engineVersion, hash, datasourceUrl }) => {
				return env.KV.put(`schema-${engineVersion}:${hash}:${datasourceUrl}`, inlineSchema, { expirationTtl: 60 * 60 * 24 * 7 });
			},
		});

		const url = new URL(request.url);
		const paths = url.pathname.split('/');
		const [_, version, hash, command] = paths;
		const headers = Object.fromEntries(request.headers.entries());
		const createResponse = (result: Promise<unknown>) =>
			result
				.then((r) => {
					return new Response(JSON.stringify(r), {
						headers: { 'content-type': 'application/json' },
					});
				})
				.catch((e) => {
					if (e instanceof ResultError) {
						console.error(e.value);
						return new Response(JSON.stringify(e.value), {
							status: e.code,
							headers: { 'content-type': 'application/json' },
						});
					}
					return new Response(JSON.stringify(e), {
						status: 500,
						headers: { 'content-type': 'application/json' },
					});
				});

		if (request.method === 'POST') {
			const body = await request.text();
			switch (command) {
				case 'graphql':
					return createResponse(prismaAccelerate.query({ body, hash, headers }));
				case 'transaction':
					return createResponse(
						prismaAccelerate.startTransaction({
							body,
							hash,
							headers,
							version,
						})
					);
				case 'itx': {
					const id = paths[4];
					switch (paths[5]) {
						case 'commit':
							return createResponse(
								prismaAccelerate.commitTransaction({
									id,
									hash,
									headers,
								})
							);
						case 'rollback':
							return createResponse(
								prismaAccelerate.rollbackTransaction({
									id,
									hash,
									headers,
								})
							);
					}
				}
			}
		} else if (request.method === 'PUT') {
			const body = await request.text();
			switch (command) {
				case 'schema':
					return createResponse(
						prismaAccelerate.updateSchema({
							body,
							hash,
							headers,
						})
					);
			}
		}
		return new Response('Not Found', { status: 404 });
	},
};
