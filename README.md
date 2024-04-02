# prisma-accelerate-workers

Make D1 database available remotely

## Required settings on the Cloudflare Workers side.

### fix prisma adapter

Prisma's Adapter calls unnecessary util and needs to be addressed.

- src/polyfills/util.ts

```ts
export * from 'node:util';
```

- tsconfig.json

```json
{
	"compilerOptions": {
		"baseUrl": ".",
		"paths": {
			"util": ["src/polyfills/util"]
		}
	}
}
```

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
