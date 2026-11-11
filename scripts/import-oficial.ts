// Uso local: importa IPI (TIPI, Receita Federal) e Imposto de Importacao (TEC, MDIC/Gecex)
// para public.ncm_aliquotas, direto dos arquivos OFICIAIS. Reexecute quando houver nova versao.
// Regra: so grava onde a fonte oficial traz valor. Ausencia de dado nunca vira 0 nem e inferida.
import "dotenv/config";
import { unzipSync } from "fflate";
import pg from "pg";

const TIPI_URL = "https://www.gov.br/receitafederal/pt-br/acesso-a-informacao/legislacao/documentos-e-arquivos/tipi.xlsx";
const TEC_PAGE = "https://www.gov.br/mdic/pt-br/assuntos/camex/se-camex/strat/tarifas/vigentes";
const UA = { "user-agent": "Mozilla/5.0 (portal-ncm import)" };

type Row = Record<string, string>;
type Sheet = { name: string; rows: Row[] };

// ---------- leitura de .xlsx (sem dependencias pesadas) ----------
const dec = new TextDecoder();
const unesc = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");

function parseXlsx(buf: Uint8Array): Sheet[] {
  const f = unzipSync(buf);
  const text = (p: string) => dec.decode(f[p]);
  const ss = [...text("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    unesc([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]).join("")),
  );
  const rels = new Map<string, string>();
  for (const m of text("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = /Id="([^"]+)"/.exec(m[1])?.[1];
    const target = /Target="([^"]+)"/.exec(m[1])?.[1];
    if (id && target) rels.set(id, target.replace(/^\/?(xl\/)?/, "xl/"));
  }
  const sheets: Sheet[] = [];
  for (const m of text("xl/workbook.xml").matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = unesc(/name="([^"]+)"/.exec(m[1])?.[1] ?? "");
    const rid = /r:id="([^"]+)"/.exec(m[1])?.[1] ?? "";
    const path = rels.get(rid);
    if (!path || !f[path]) continue;
    const rows: Row[] = [];
    for (const r of text(path).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row: Row = {};
      for (const c of r[1].matchAll(/<c r="([A-Z]+)\d+"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const [, col, attr, inner] = c;
        if (!inner) continue;
        const v = /<v>([\s\S]*?)<\/v>/.exec(inner);
        if (v) row[col] = /t="s"/.test(attr) ? ss[Number(v[1])] : unesc(v[1]);
        else {
          const t = /<t[^>]*>([\s\S]*?)<\/t>/.exec(inner);
          if (t) row[col] = unesc(t[1]);
        }
      }
      rows.push(row);
    }
    sheets.push({ name, rows });
  }
  return sheets;
}

async function download(url: string): Promise<Uint8Array> {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

// ---------- utilitarios ----------
const CODE = /^\d{4}\.\d{2}\.\d{2}$/;
const num = (v: string | undefined): number | null => {
  if (v === undefined) return null;
  const n = Number(v.trim().replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; // tira ruido de ponto flutuante do Excel
};
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const iso = (d: Date) => d.toISOString().slice(0, 10);
const br = (s: string) => s.split("-").reverse().join("/");

/** data do Excel (numero serial) ou "dd/mm/aaaa" -> "aaaa-mm-dd"; "-" ou vazio -> null */
function toDate(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  if (!s || s === "-") return null;
  if (/^\d{4,6}$/.test(s)) return iso(new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000));
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// ---------- TIPI (IPI) ----------
function readTipi(sheets: Sheet[]) {
  const rows = sheets[0].rows;
  const main = new Map<string, string>();
  const exs = new Map<string, string[]>();
  for (const r of rows) {
    const code = (r.A ?? "").trim();
    if (!CODE.test(code)) continue;
    const v = (r.D ?? "").trim();
    if (!v) continue;
    const ex = (r.B ?? "").trim();
    if (ex) {
      const n = num(v);
      exs.set(code, [...(exs.get(code) ?? []), `Ex ${ex}: ${v === "NT" ? "NT" : n === null ? v : pct(n)}`]);
    } else main.set(code, v);
  }
  // data da ultima atualizacao citada no cabecalho da planilha
  const head = rows.slice(0, 5).map((r) => r.A ?? "").join(" ");
  let last: string | null = null;
  for (const m of head.matchAll(/(\d{1,2})º? de (\p{L}+) de (\d{4})/gu)) {
    const mi = MESES.indexOf(m[2].toLowerCase());
    if (mi >= 0) last = `${m[3]}-${String(mi + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return { main, exs, last };
}

// ---------- TEC (II) ----------
type ExcDef = { sheet: RegExp; nome: string; aliq: string; quota: string; unid: string; ini: string; fim?: string; ato: string };
const EXC: ExcDef[] = [
  { sheet: /Anexo IV/, nome: "Desabastecimento", aliq: "D", quota: "E", unid: "F", ini: "J", fim: "K", ato: "G" },
  { sheet: /Anexo V -/, nome: "LETEC", aliq: "C", quota: "E", unid: "F", ini: "G", fim: "H", ato: "I" },
  { sheet: /Anexo VI/, nome: "BIT/BK", aliq: "D", quota: "E", unid: "F", ini: "H", fim: "I", ato: "G" },
  { sheet: /Anexo VIII/, nome: "Concessão OMC", aliq: "C", quota: "E", unid: "F", ini: "I", ato: "H" },
  { sheet: /Anexo IX/, nome: "Elevação DCC", aliq: "C", quota: "E", unid: "F", ini: "G", fim: "H", ato: "I" },
  { sheet: /Anexo X/, nome: "Automotivos ACE-14", aliq: "C", quota: "E", unid: "F", ini: "G", fim: "H", ato: "I" },
];

function readTec(sheets: Sheet[], today: string) {
  const find = (re: RegExp) => sheets.find((s) => re.test(s.name))!;
  // No Anexo I, bens de capital/informatica vem como "12,6BK" ou "0BIT" (valor + sigla do regime)
  const tec = new Map<string, number>();
  const regime = new Map<string, string>();
  for (const r of find(/Anexo I -/).rows) {
    const c = (r.A ?? "").trim();
    const m = /^([\d.,]+)\s*(BK|BIT)?$/i.exec((r.C ?? "").trim());
    const v = m ? num(m[1]) : null;
    if (CODE.test(c) && v !== null) {
      tec.set(c, v);
      if (m![2]) regime.set(c, m![2].toUpperCase());
    }
  }
  const applied = new Map<string, { aplicada: number; bitbk: string }>();
  for (const r of find(/Anexo II/).rows) {
    const c = (r.A ?? "").trim();
    const v = num(r.F);
    if (CODE.test(c) && v !== null && !applied.has(c)) applied.set(c, { aplicada: v, bitbk: (r.D ?? "").trim() });
  }
  const exc = new Map<string, string[]>();
  for (const def of EXC) {
    const sh = sheets.find((s) => def.sheet.test(s.name));
    if (!sh) continue;
    for (const r of sh.rows) {
      const c = (r.A ?? "").trim();
      const a = num(r[def.aliq]);
      if (!CODE.test(c) || a === null) continue;
      const ini = toDate(r[def.ini]);
      const fim = def.fim ? toDate(r[def.fim]) : null;
      if ((ini && ini > today) || (fim && fim < today)) continue; // so excecoes vigentes hoje
      const ex = (r.B ?? "").trim();
      const q = (r[def.quota] ?? "").trim();
      const cota = q && q !== "-" ? `cota de ${Number(q).toLocaleString("pt-BR")} ${(r[def.unid] ?? "").trim()}` : "sem cota";
      const ato = (r[def.ato] ?? "").trim();
      const line = `${def.nome}: ${pct(a)}${ex && ex !== "-" ? ` (Ex ${ex})` : ""}, ${cota}${fim ? `, até ${br(fim)}` : ""}${ato && ato !== "-" ? `. ${ato}` : ""}`;
      exc.set(c, [...(exc.get(c) ?? []), line]);
    }
  }
  return { tec, regime, applied, exc };
}

async function main() {
  const today = iso(new Date());

  console.log("Baixando TIPI (Receita Federal)…");
  const tipi = readTipi(parseXlsx(await download(TIPI_URL)));

  console.log("Procurando a planilha atual da TEC (MDIC)…");
  const page = await (await fetch(TEC_PAGE, { headers: UA })).text();
  const href = /href="([^"]*anexos-i-a-x-resolucao-gecex-272-21\.xlsx)"/.exec(page)?.[1];
  if (!href) throw new Error("link da planilha da TEC nao encontrado na pagina do MDIC");
  const tecUrl = new URL(href, TEC_PAGE).toString();
  const tecDate = /(\d{2})-(\d{2})-(\d{4})-anexos/.exec(tecUrl);
  const tecVig = tecDate ? `${tecDate[3]}-${tecDate[2]}-${tecDate[1]}` : today;
  console.log("  ->", tecUrl);
  const tec = readTec(parseXlsx(await download(tecUrl)), today);

  // ----- monta as linhas -----
  const FONTE_IPI = "TIPI, Receita Federal (Decreto 11.158/2022 e atos posteriores)";
  const FONTE_II = "TEC, MDIC/Gecex (Resolução Gecex 272/2021 e atos posteriores)";
  const rows: [string, string, number | null, string | null, string, string | null][] = [];

  for (const [code, v] of tipi.main) {
    const ex = tipi.exs.get(code) ?? [];
    if (v === "NT") rows.push([code, "IPI", null, ["NT", ...ex].join("\n"), FONTE_IPI, tipi.last]);
    else {
      const n = num(v);
      if (n !== null) rows.push([code, "IPI", n, ex.length ? ex.join("\n") : null, FONTE_IPI, tipi.last]);
    }
  }
  for (const [code, t] of tec.tec) {
    const ap = tec.applied.get(code);
    const aliquota = ap ? ap.aplicada : t;
    const notas: string[] = [];
    if (aliquota !== t) notas.push(`TEC Mercosul: ${pct(t)}`);
    const reg = ap?.bitbk || tec.regime.get(code);
    if (reg) notas.push(`Regime ${reg === "BK" ? "BK (bem de capital)" : reg === "BIT" ? "BIT (informática e telecomunicações)" : reg}`);
    const e = tec.exc.get(code) ?? [];
    notas.push(...e.slice(0, 4).map((l) => `Exceção vigente, ${l}`));
    if (e.length > 4) notas.push(`e mais ${e.length - 4} exceções vigentes`);
    rows.push([code, "II", aliquota, notas.join("\n") || null, FONTE_II, tecVig]);
  }

  const ipiN = rows.filter((r) => r[1] === "IPI").length;
  const iiN = rows.filter((r) => r[1] === "II").length;
  console.log(`IPI: ${ipiN} itens | II: ${iiN} itens | exceções vigentes em ${tec.exc.size} NCM`);
  // trava de seguranca: nao apaga o banco se a fonte vier incompleta
  if (ipiN < 10000 || iiN < 10000) throw new Error("cobertura abaixo do esperado; importacao cancelada");

  const c = new pg.Client({
    host: `db.${new URL(process.env.SUPABASE_URL!).hostname.split(".")[0]}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: process.env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  const known = new Set((await c.query("select codigo from public.ncm_codes")).rows.map((r) => r.codigo as string));
  const ok = rows.filter((r) => known.has(r[0]));
  console.log(`linhas com codigo existente na NCM: ${ok.length} de ${rows.length} (as demais sao descartadas)`);
  await c.query("begin");
  await c.query("delete from public.ncm_aliquotas");
  for (let i = 0; i < ok.length; i += 1000) {
    const chunk = ok.slice(i, i + 1000);
    const vals: unknown[] = [];
    const ph = chunk.map((r, k) => {
      vals.push(...r);
      const b = k * 6;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`;
    });
    await c.query(`insert into public.ncm_aliquotas (codigo,tributo,aliquota,nota,fonte,vigencia) values ${ph.join(",")}`, vals);
  }
  await c.query("commit");
  const s = await c.query("select tributo, count(*)::int n, count(aliquota)::int com_valor, count(nota)::int com_nota from public.ncm_aliquotas group by tributo order by tributo");
  console.table(s.rows);
  await c.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
