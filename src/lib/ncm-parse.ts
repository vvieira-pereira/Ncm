export type RawNcm = {
  Codigo: string;
  Descricao: string;
  Data_Inicio: string;
  Data_Fim: string;
  Tipo_Ato_Ini: string;
  Numero_Ato_Ini: string;
  Ano_Ato_Ini: string;
};

export type NcmRow = {
  codigo: string;
  digits: string;
  descricao: string;
  nivel: number;
  pai: string | null;
  dataInicio: string;
  dataFim: string | null;
  ato: string;
};

/** Remove marcacao HTML e hifens iniciais das descricoes oficiais. */
export function cleanDescription(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, "")
    .replace(/^(?:-\s*)+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toIso(br: string): string {
  const [d, m, y] = br.split("/");
  return `${y}-${m}-${d}`;
}

/** nivel: 0 capitulo, 1 posicao, 2 subposicao/item. */
function levelFromDigits(digits: string): number {
  if (digits.length <= 2) return 0;
  if (digits.length === 4) return 1;
  return 2;
}

export function parseNcm(raw: RawNcm[]): NcmRow[] {
  const byDigits = new Map<string, string>();
  const rows = raw.map((r) => {
    const digits = r.Codigo.replace(/\./g, "");
    byDigits.set(digits, r.Codigo);
    return { r, digits };
  });

  return rows.map(({ r, digits }) => {
    let pai: string | null = null;
    for (let n = digits.length - 1; n >= 2; n--) {
      const hit = byDigits.get(digits.slice(0, n));
      if (hit) {
        pai = hit;
        break;
      }
    }
    return {
      codigo: r.Codigo,
      digits,
      descricao: cleanDescription(r.Descricao),
      nivel: levelFromDigits(digits),
      pai,
      dataInicio: toIso(r.Data_Inicio),
      dataFim: r.Data_Fim.endsWith("9999") ? null : toIso(r.Data_Fim),
      ato: `${r.Tipo_Ato_Ini} ${r.Numero_Ato_Ini}/${r.Ano_Ato_Ini}`,
    };
  });
}
