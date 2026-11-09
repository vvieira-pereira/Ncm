export type IndexFile = {
  atualizacao: string;
  atos: string[];
  /** [codigo, descricao, indicePai (-1 = nenhum), indiceAto, dataInicio ISO] */
  itens: [string, string, number, number, string][];
};

export type NcmItem = {
  id: number;
  codigo: string;
  digits: string;
  descricao: string;
  pai: number;
  nivel: number;
  ato: string;
  inicio: string;
};

export type Engine = {
  items: NcmItem[];
  /** descricoes dos ancestrais + propria, normalizadas */
  haystack: string[];
  own: string[];
  byCode: Map<string, number>;
  search: (query: string, limit?: number) => NcmItem[];
  ancestors: (id: number) => NcmItem[];
  children: (id: number) => NcmItem[];
};

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENERIC = new Set(["outros", "outras", "outro", "outra"]);

export function createEngine(data: IndexFile): Engine {
  const items: NcmItem[] = data.itens.map(([codigo, descricao, pai, ato, inicio], id) => {
    const digits = codigo.replace(/\./g, "");
    return {
      id,
      codigo,
      digits,
      descricao,
      pai,
      nivel: digits.length <= 2 ? 0 : digits.length === 4 ? 1 : 2,
      ato: data.atos[ato],
      inicio,
    };
  });
  const own = items.map((i) => normalize(i.descricao));
  const haystack: string[] = new Array(items.length);
  for (const i of items) {
    // pais sempre vem antes dos filhos no arquivo oficial
    haystack[i.id] = i.pai >= 0 ? `${haystack[i.pai]} ${own[i.id]}` : own[i.id];
  }
  const byCode = new Map(items.map((i) => [i.codigo, i.id]));
  const childMap = new Map<number, number[]>();
  for (const i of items) {
    if (i.pai >= 0) {
      const list = childMap.get(i.pai);
      if (list) list.push(i.id);
      else childMap.set(i.pai, [i.id]);
    }
  }

  function search(query: string, limit = 80): NcmItem[] {
    const q = query.trim().slice(0, 80);
    if (!q) return [];
    if (/^[\d.\s-]+$/.test(q)) {
      const d = q.replace(/\D/g, "");
      if (!d) return [];
      const out: NcmItem[] = [];
      let exact: NcmItem | undefined;
      for (const i of items) {
        if (i.digits === d) exact = i;
        else if (i.digits.startsWith(d)) out.push(i);
        if (out.length >= limit) break;
      }
      return exact ? [exact, ...out.slice(0, limit - 1)] : out;
    }
    const tokens = normalize(q).split(" ").filter(Boolean);
    if (!tokens.length) return [];
    const scored: { i: NcmItem; s: number }[] = [];
    for (const i of items) {
      const h = haystack[i.id];
      let ok = true;
      for (const t of tokens) {
        if (!h.includes(t)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const o = own[i.id];
      let s = 0;
      for (const t of tokens) {
        if (o.includes(t)) s += 2;
        if (o.startsWith(t) || o.includes(` ${t}`)) s += 2;
      }
      if (GENERIC.has(o)) s -= 2;
      s -= i.nivel === 2 ? 0 : -1; // posicoes/capitulos sobem um pouco
      scored.push({ i, s });
    }
    scored.sort((a, b) => b.s - a.s || a.i.id - b.i.id);
    return scored.slice(0, limit).map((x) => x.i);
  }

  function ancestors(id: number): NcmItem[] {
    const chain: NcmItem[] = [];
    let p = items[id].pai;
    while (p >= 0) {
      chain.unshift(items[p]);
      p = items[p].pai;
    }
    return chain;
  }

  function children(id: number): NcmItem[] {
    return (childMap.get(id) ?? []).map((c) => items[c]);
  }

  return { items, haystack, own, byCode, search, ancestors, children };
}
