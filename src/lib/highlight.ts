/** Dobra acentos/caixa mantendo o mesmo comprimento do texto original. */
export function fold(s: string): string {
  let out = "";
  for (const ch of s) {
    const f = ch.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    out += f.length === 1 ? f : ch.toLowerCase().slice(0, 1);
  }
  return out;
}

export type Piece = { text: string; hit: boolean };

/** Divide o texto em trechos para destacar os termos buscados (sem HTML injetado). */
export function highlight(text: string, query: string): Piece[] {
  const terms = fold(query)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !/^\d+$/.test(t));
  if (!terms.length) return [{ text, hit: false }];
  const folded = fold(text);
  if (folded.length !== text.length) return [{ text, hit: false }];
  const mask = new Array<boolean>(text.length).fill(false);
  for (const t of terms) {
    let from = 0;
    for (;;) {
      const at = folded.indexOf(t, from);
      if (at < 0) break;
      for (let k = at; k < at + t.length; k++) mask[k] = true;
      from = at + t.length;
    }
  }
  const out: Piece[] = [];
  for (let i = 0; i < text.length; i++) {
    const last = out[out.length - 1];
    if (last && last.hit === mask[i]) last.text += text[i];
    else out.push({ text: text[i], hit: mask[i] });
  }
  return out;
}
