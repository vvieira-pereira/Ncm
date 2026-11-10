import { handleIbpt, type Env } from "./ibpt";

type WorkerEnv = Env & { ASSETS: Fetcher };

export default {
  async fetch(req: Request, env: WorkerEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/api/ibpt") {
      return handleIbpt(req, env, {
        // chamar o fetch global solto (sem o `this` correto) da "Illegal invocation" no Workers
        fetch: (input, init) => fetch(input, init),
        cache: (caches as unknown as { default: Cache }).default,
        waitUntil: (p) => ctx.waitUntil(p),
      });
    }
    // todo o resto e o site estatico
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<WorkerEnv>;
