// Logica pura do proxy IBPT (sem APIs especificas do Cloudflare, para poder ser testada).
// O token e o CNPJ ficam so no servidor (segredos do Worker) e nunca chegam ao navegador.

export type Env = {
  IBPT_TOKEN?: string;
  IBPT_CNPJ?: string;
  /** origens extras permitidas por CORS, separadas por virgula (so para desenvolvimento) */
  ALLOWED_ORIGINS?: string;
};

export type IbptResult = {
  codigo: string;
  uf: string;
  nacional: number;
  importado: number;
  estadual: number;
  municipal: number;
  tipo: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  versao: string;
  fonte: string;
};

type CacheLike = {
  match: (key: Request) => Promise<Response | undefined>;
  put: (key: Request, res: Response) => Promise<void>;
};

export type Deps = {
  fetch: typeof fetch;
  cache?: CacheLike;
  waitUntil?: (p: Promise<unknown>) => void;
};

const UPSTREAM = "https://apidoni.ibpt.org.br/api/v1/produtos";
const UFS = new Set(
  "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "),
);

export function parseQuery(url: URL): { codigo: string; uf: string } | null {
  const raw = url.searchParams.get("codigo") ?? "";
  if (!/^[\d.]{8,10}$/.test(raw)) return null; // so digitos e pontos; qualquer outra coisa e rejeitada
  const codigo = raw.replace(/\./g, "");
  const uf = (url.searchParams.get("uf") ?? "SP").toUpperCase();
  if (!/^\d{8}$/.test(codigo) || !UFS.has(uf)) return null;
  return { codigo, uf };
}

const clip = (v: unknown, n = 80) => (typeof v === "string" ? v.slice(0, n) : "");

/** Reduz a resposta do IBPT aos campos necessarios; qualquer formato inesperado vira null. */
export function shapeUpstream(json: unknown, codigo: string, uf: string): IbptResult | null {
  const item = Array.isArray(json) ? json[0] : json;
  if (!item || typeof item !== "object") return null;
  const o = item as Record<string, unknown>;
  const nums = [o.Nacional, o.Importado, o.Estadual, o.Municipal].map((v) => (typeof v === "number" ? v : Number.NaN));
  if (nums.some((n) => !Number.isFinite(n) || n < 0 || n > 100)) return null;
  const [nacional, importado, estadual, municipal] = nums;
  return {
    codigo,
    uf,
    nacional,
    importado,
    estadual,
    municipal,
    tipo: clip(o.Tipo, 20),
    vigenciaInicio: clip(o.VigenciaInicio, 20),
    vigenciaFim: clip(o.VigenciaFim, 20),
    versao: clip(o.Versao, 20),
    fonte: clip(o.Fonte, 60) || "IBPT",
  };
}

function json(body: unknown, status: number, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      "cache-control": status === 200 ? "public, max-age=3600" : "no-store",
      ...extra,
    },
  });
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return origin && allowed.includes(origin) ? { "access-control-allow-origin": origin, vary: "origin" } : {};
}

export async function handleIbpt(req: Request, env: Env, deps: Deps): Promise<Response> {
  const cors = corsHeaders(req, env);
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...cors, "access-control-allow-methods": "GET", "access-control-max-age": "86400" } });
  }
  if (req.method !== "GET") return json({ erro: "metodo_nao_permitido" }, 405, cors);

  const q = parseQuery(new URL(req.url));
  if (!q) return json({ erro: "parametros_invalidos" }, 400, cors);
  if (!env.IBPT_TOKEN || !env.IBPT_CNPJ) return json({ erro: "nao_configurado" }, 503, cors);

  const cacheKey = new Request(`https://ibpt.cache/${q.uf}/${q.codigo}`);
  const hit = await deps.cache?.match(cacheKey);
  if (hit) return new Response(hit.body, { status: 200, headers: { ...Object.fromEntries(hit.headers), ...cors } });

  const u = new URL(UPSTREAM);
  u.search = new URLSearchParams({
    token: env.IBPT_TOKEN,
    cnpj: env.IBPT_CNPJ.replace(/\D/g, ""),
    codigo: q.codigo,
    uf: q.uf,
    ex: "0",
    descricao: "Consulta NCM",
    unidadeMedida: "UN",
    valor: "100",
    gtin: "SEM GTIN",
  }).toString();

  let upstream: Response;
  try {
    upstream = await deps.fetch(u, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  } catch {
    return json({ erro: "indisponivel" }, 502, cors);
  }
  if (upstream.status === 404) return json({ erro: "nao_encontrado" }, 404, cors);
  if (!upstream.ok) return json({ erro: "indisponivel" }, 502, cors); // nunca repassa detalhes do upstream

  let data: unknown;
  try {
    data = await upstream.json();
  } catch {
    return json({ erro: "indisponivel" }, 502, cors);
  }
  const shaped = shapeUpstream(data, q.codigo, q.uf);
  if (!shaped) return json({ erro: "nao_encontrado" }, 404, cors);

  const res = json(shaped, 200, cors);
  if (deps.cache) {
    const store = deps.cache.put(cacheKey, new Response(JSON.stringify(shaped), { headers: { "content-type": "application/json", "cache-control": "public, max-age=86400" } }));
    deps.waitUntil ? deps.waitUntil(store) : await store;
  }
  return res;
}
