// Uso local: aplica migrations e carrega o JSON do NCM. Le segredos do .env (nao versionado).
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { parseNcm, type RawNcm } from "../src/lib/ncm-parse";

const url = process.env.SUPABASE_URL!;
const ref = new URL(url).hostname.split(".")[0];
const password = process.env.SUPABASE_DB_PASSWORD!;
const hosts = [
  { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" },
  ...["sa-east-1", "us-east-1", "us-east-2", "eu-west-1", "eu-central-1"].flatMap((r) => [
    { host: `aws-0-${r}.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
    { host: `aws-1-${r}.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
  ]),
];

async function connect() {
  for (const h of hosts) {
    const c = new pg.Client({
      ...h,
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 6000,
    });
    try {
      await c.connect();
      console.log("conectado em", h.host);
      return c;
    } catch (e) {
      console.log("falhou", h.host, (e as Error).message);
    }
  }
  throw new Error("sem conexao com o banco");
}

async function main() {
  const c = await connect();
  const dir = join(process.cwd(), "supabase", "migrations");
  const applied = await c.query("select to_regclass('public.ncm_codes') as t");
  if (!applied.rows[0].t) {
    for (const f of readdirSync(dir).sort()) {
      console.log("migration", f);
      await c.query(readFileSync(join(dir, f), "utf8"));
    }
  }
  const file = readdirSync(process.cwd()).find((f) => f.startsWith("Tabela_NCM") && f.endsWith(".json"))!;
  const raw = JSON.parse(readFileSync(file, "utf8")).Nomenclaturas as RawNcm[];
  const rows = parseNcm(raw);
  rows.sort((a, b) => a.digits.length - b.digits.length); // pais antes dos filhos (FK)
  await c.query("begin");
  await c.query("delete from public.ncm_codes");
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    const vals: unknown[] = [];
    const ph = chunk.map((r, k) => {
      vals.push(r.codigo, r.digits, r.descricao, r.nivel, r.pai, r.dataInicio, r.dataFim, r.ato);
      const b = k * 8;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`;
    });
    await c.query(
      `insert into public.ncm_codes (codigo,digits,descricao,nivel,pai,data_inicio,data_fim,ato) values ${ph.join(",")}`,
      vals,
    );
  }
  await c.query("commit");
  const n = await c.query("select count(*)::int as n from public.ncm_codes");
  console.log("registros:", n.rows[0].n, "esperado:", raw.length);
  await c.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
