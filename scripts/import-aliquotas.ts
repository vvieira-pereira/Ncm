// Uso local: importa IPI (TIPI) e Imposto de Importacao (TEC) para public.ncm_aliquotas.
// Fonte: tabelasfiscais.com.br (agrega Receita Federal/TIPI, MDIC-Gecex/TEC e Siscomex), "como esta", sem garantia.
// Regra: so grava onde a fonte traz valor. Ausencia de dado NAO vira 0 nem e inferida.
import "dotenv/config";
import pg from "pg";

const BASE = "https://tabelasfiscais.com.br/public/downloads";
const FONTE_IPI = "TIPI (Decreto 11.158/2022 e atos), via tabelasfiscais.com.br";
const FONTE_II = "TEC (Res. Gecex 272/2021 e atos), via tabelasfiscais.com.br";

type NcmRow = { codigo: string; nivel: number; ipi: string | null; ii: string | null };
type TecRow = {
  codigo: string;
  tec_mercosul: string | null;
  bit_bk: string | null;
  excecao_nacional: string | null;
  tem_ex_tarifario: number | null;
};

async function load<T>(name: string): Promise<{ gerado_em: string; dados: T[] }> {
  const r = await fetch(`${BASE}/${name}.json`, { headers: { "user-agent": "portal-ncm-import" } });
  if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
  return r.json();
}

const NUM = /^\d+(\.\d+)?$/;

async function main() {
  const [ncm, tec] = await Promise.all([load<NcmRow>("ncm"), load<TecRow>("tec")]);
  const tecBy = new Map(tec.dados.map((t) => [t.codigo, t]));
  const vig = ncm.gerado_em?.slice(0, 10) ?? null;

  const rows: [string, string, number | null, string | null, string, string | null][] = [];
  for (const r of ncm.dados) {
    if (r.nivel !== 8) continue;
    if (r.ipi === "NT") rows.push([r.codigo, "IPI", null, "NT", FONTE_IPI, vig]);
    else if (r.ipi && NUM.test(r.ipi)) rows.push([r.codigo, "IPI", Number(r.ipi), null, FONTE_IPI, vig]);

    if (r.ii && NUM.test(r.ii)) {
      const t = tecBy.get(r.codigo);
      const notas: string[] = [];
      if (t?.tec_mercosul && NUM.test(t.tec_mercosul) && t.tec_mercosul !== r.ii) notas.push(`TEC Mercosul ${t.tec_mercosul}%`);
      if (t?.excecao_nacional) notas.push(`exceção nacional: ${t.excecao_nacional}`);
      if (t?.bit_bk) notas.push(`regime ${t.bit_bk}`);
      if (t?.tem_ex_tarifario) notas.push("possui ex-tarifário");
      rows.push([r.codigo, "II", Number(r.ii), notas.join("; ") || null, FONTE_II, vig]);
    }
  }

  const c = new pg.Client({
    host: `db.${new URL(process.env.SUPABASE_URL!).hostname.split(".")[0]}.supabase.co`,
    port: 5432,
    user: "postgres",
    password: process.env.SUPABASE_DB_PASSWORD,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
  });
  await c.connect();
  await c.query("begin");
  await c.query("delete from public.ncm_aliquotas");
  for (let i = 0; i < rows.length; i += 1000) {
    const chunk = rows.slice(i, i + 1000);
    const vals: unknown[] = [];
    const ph = chunk.map((r, k) => {
      vals.push(...r);
      const b = k * 6;
      return `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`;
    });
    await c.query(`insert into public.ncm_aliquotas (codigo,tributo,aliquota,nota,fonte,vigencia) values ${ph.join(",")}`, vals);
  }
  await c.query("commit");
  const s = await c.query(
    "select tributo, count(*)::int n, count(aliquota)::int com_valor from public.ncm_aliquotas group by tributo order by tributo",
  );
  console.log("gerado_em da fonte:", ncm.gerado_em);
  console.table(s.rows);
  await c.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
