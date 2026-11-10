import { describe, expect, it, vi } from "vitest";
import { handleIbpt, parseQuery, shapeUpstream, type Env } from "../worker/ibpt";

const env: Env = { IBPT_TOKEN: "TOKEN-SECRETO-123", IBPT_CNPJ: "12.345.678/0001-90", ALLOWED_ORIGINS: "http://localhost:3000" };
const req = (qs: string, init?: RequestInit) => new Request(`https://x.test/api/ibpt?${qs}`, init);
const upstreamOk = [{ Codigo: "61091000", UF: "SP", Nacional: 13.45, Importado: 18.2, Estadual: 18, Municipal: 0, Tipo: "0", VigenciaInicio: "01/11/2026", VigenciaFim: "30/11/2026", Versao: "26.2.A", Fonte: "IBPT/empresometro.com.br" }];
const jsonRes = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

describe("parseQuery", () => {
  it("aceita NCM de 8 digitos (com ou sem pontos) e UF valida", () => {
    expect(parseQuery(new URL("https://x/?codigo=6109.10.00&uf=sp"))).toEqual({ codigo: "61091000", uf: "SP" });
    expect(parseQuery(new URL("https://x/?codigo=61091000"))).toEqual({ codigo: "61091000", uf: "SP" });
  });
  it("rejeita codigo curto, injecao e UF invalida", () => {
    expect(parseQuery(new URL("https://x/?codigo=6109"))).toBeNull();
    expect(parseQuery(new URL("https://x/?codigo=61091000&uf=XX"))).toBeNull();
    expect(parseQuery(new URL("https://x/?codigo=61091000%26token%3Dabc&uf=SP"))).toBeNull();
  });
});

describe("shapeUpstream", () => {
  it("extrai so os campos esperados", () => {
    const r = shapeUpstream(upstreamOk, "61091000", "SP")!;
    expect(r.nacional).toBe(13.45);
    expect(r.estadual).toBe(18);
    expect(Object.keys(r)).not.toContain("Chave");
  });
  it("devolve null para formato inesperado ou valores fora de faixa", () => {
    expect(shapeUpstream({ Nacional: "x" }, "1", "SP")).toBeNull();
    expect(shapeUpstream([{ Nacional: 500, Importado: 1, Estadual: 1, Municipal: 1 }], "1", "SP")).toBeNull();
    expect(shapeUpstream(null, "1", "SP")).toBeNull();
  });
});

describe("handleIbpt", () => {
  it("consulta o IBPT no servidor e NAO vaza token nem CNPJ na resposta", async () => {
    const f = vi.fn(async (_url: unknown) => jsonRes(upstreamOk));
    const res = await handleIbpt(req("codigo=6109.10.00&uf=SP"), env, { fetch: f as unknown as typeof fetch });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("13.45");
    expect(text).not.toContain("TOKEN-SECRETO");
    expect(text).not.toContain("12345678");
    const called = String(f.mock.calls[0][0]);
    expect(called).toContain("token=TOKEN-SECRETO-123");
    expect(called).toContain("cnpj=12345678000190");
    expect(called).toContain("codigo=61091000");
  });

  it("nao repassa erro do upstream (401, 500) e responde 502 generico", async () => {
    for (const status of [401, 403, 500]) {
      const res = await handleIbpt(req("codigo=61091000"), env, { fetch: (async () => new Response("TOKEN invalido NK3M...", { status })) as typeof fetch });
      expect(res.status).toBe(502);
      expect(await res.text()).toBe('{"erro":"indisponivel"}');
    }
  });

  it("503 quando segredos nao estao configurados, 400 para parametros ruins, 405 para POST", async () => {
    const f = (async () => jsonRes(upstreamOk)) as typeof fetch;
    expect((await handleIbpt(req("codigo=61091000"), {}, { fetch: f })).status).toBe(503);
    expect((await handleIbpt(req("codigo=abc"), env, { fetch: f })).status).toBe(400);
    expect((await handleIbpt(req("codigo=61091000", { method: "POST" }), env, { fetch: f })).status).toBe(405);
  });

  it("CORS so para origens permitidas", async () => {
    const f = (async () => jsonRes(upstreamOk)) as typeof fetch;
    const ok = await handleIbpt(req("codigo=61091000", { headers: { origin: "http://localhost:3000" } }), env, { fetch: f });
    expect(ok.headers.get("access-control-allow-origin")).toBe("http://localhost:3000");
    const no = await handleIbpt(req("codigo=61091000", { headers: { origin: "https://malicioso.example" } }), env, { fetch: f });
    expect(no.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("usa o cache e evita nova chamada ao IBPT", async () => {
    const store = new Map<string, Response>();
    const cache = {
      match: async (k: Request) => store.get(k.url)?.clone(),
      put: async (k: Request, r: Response) => void store.set(k.url, r.clone()),
    };
    const f = vi.fn(async () => jsonRes(upstreamOk));
    const deps = { fetch: f as unknown as typeof fetch, cache };
    await handleIbpt(req("codigo=61091000"), env, deps);
    const second = await handleIbpt(req("codigo=61091000"), env, deps);
    expect(f).toHaveBeenCalledTimes(1);
    expect((await second.json()).nacional).toBe(13.45);
  });
});
