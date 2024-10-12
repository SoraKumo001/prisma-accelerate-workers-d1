# prisma-accelerate-workers

Make Cloudflare D1 database available remotely

## Required settings on the Cloudflare Workers side.

### Cloudflare Workers Settings/Environment Variables

wrangler.toml

```toml
minify = true
compatibility_flags = [ "nodejs_compat" ]

[[kv_namespaces]]
binding = "KV"
id = "xxxxxx"

[[d1_databases]]
binding = "DB"
database_name = "xxxxx"
database_id ="xxxxxxx"

[vars]
SECRET = "**********"
```

- src/index.ts

```ts
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
```

## Create API key

npx prisma-accelerate-local -s SECRET -m BINDING_NAME

```bash
npx prisma-accelerate-local -s abc -m DB
```

## Client-side configuration

Prior requirements

- Migration of D1
- Generate prisma client

```ts
import { PrismaClient } from '@prisma/client';

const main = async () => {
	const prisma = new PrismaClient({
		datasourceUrl: 'prisma://xxxxx.workers.dev/?api_key=xxxxxxxx',
	});
	prisma.post.findMany().then((posts) => {
		console.log(posts);
	});
};
main();
```
