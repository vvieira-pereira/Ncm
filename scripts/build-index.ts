// Gera public/ncm-index.json a partir do JSON oficial (uso local; o resultado e versionado).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseNcm, type RawNcm } from "../src/lib/ncm-parse";
import type { IndexFile } from "../src/lib/search";

const file = readdirSync(process.cwd()).find((f) => f.startsWith("Tabela_NCM") && f.endsWith(".json"));
if (!file) throw new Error("JSON da tabela NCM nao encontrado");
const src = JSON.parse(readFileSync(file, "utf8"));
const rows = parseNcm(src.Nomenclaturas as RawNcm[]);

const idx = new Map(rows.map((r, i) => [r.codigo, i]));
const atos: string[] = [];
const itens: IndexFile["itens"] = rows.map((r) => {
  let a = atos.indexOf(r.ato);
  if (a < 0) a = atos.push(r.ato) - 1;
  return [r.codigo, r.descricao, r.pai ? idx.get(r.pai)! : -1, a, r.dataInicio];
});
// pais devem vir antes dos filhos para o motor montar o contexto em uma passada
for (const [i, it] of itens.entries()) {
  if (it[2] >= i) throw new Error(`ordem invalida em ${it[0]}`);
}

const out: IndexFile = { atualizacao: src.Data_Ultima_Atualizacao_NCM, atos, itens };
writeFileSync(join(process.cwd(), "public", "ncm-index.json"), JSON.stringify(out));
console.log("itens:", itens.length, "atos:", atos.length);
