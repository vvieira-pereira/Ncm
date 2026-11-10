"use client";

import { useEffect, useState } from "react";

type Ibpt = {
  nacional: number;
  importado: number;
  estadual: number;
  municipal: number;
  versao: string;
  vigenciaFim: string;
  fonte: string;
};
type State = { status: "loading" } | { status: "none" } | { status: "error" } | { status: "ok"; data: Ibpt };

// Em producao a API e do mesmo dominio. Em desenvolvimento, aponte NEXT_PUBLIC_API_BASE para o Worker local.
const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";
const UF = "SP";
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

/** Carga tributaria aproximada (IBPT, Lei 12.741/2012), consultada via proxy no servidor. */
export function IbptBlock({ codigo, digits }: { codigo: string; digits: number }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (digits !== 8) return;
    const ctl = new AbortController();
    setState({ status: "loading" });
    fetch(`${BASE}/api/ibpt?codigo=${encodeURIComponent(codigo)}&uf=${UF}`, { signal: ctl.signal })
      .then(async (r) => {
        if (r.status === 404) return setState({ status: "none" });
        if (!r.ok) return setState({ status: "error" });
        setState({ status: "ok", data: (await r.json()) as Ibpt });
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") setState({ status: "error" });
      });
    return () => ctl.abort();
  }, [codigo, digits]);

  if (digits !== 8) return null;

  return (
    <section className="border-t border-line px-6 py-5">
      <h3 className="font-display text-base font-semibold">Tributos aproximados no preço ({UF})</h3>
      {state.status === "loading" && (
        <p className="mt-2 text-sm text-muted" aria-live="polite">
          Consultando o IBPT…
        </p>
      )}
      {state.status === "none" && <p className="mt-2 text-sm text-muted">O IBPT não tem valores para este código.</p>}
      {state.status === "error" && (
        <p className="mt-2 text-sm text-muted">Não foi possível consultar o IBPT agora. Tente de novo em instantes.</p>
      )}
      {state.status === "ok" && (
        <>
          <dl className="mt-2">
            {(
              [
                ["Federal, produto nacional", state.data.nacional],
                ["Federal, produto importado", state.data.importado],
                ["Estadual", state.data.estadual],
                ["Municipal", state.data.municipal],
              ] as [string, number][]
            ).map(([label, v]) => (
              <div key={label} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
                <dt className="text-sm text-muted">{label}</dt>
                <dd className="text-sm font-semibold">{pct(v)}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
            Percentual médio sobre o preço, para a informação exigida na nota ao consumidor (Lei 12.741/2012). Fonte: {state.data.fonte}, tabela
            {state.data.versao ? ` ${state.data.versao}` : ""}
            {state.data.vigenciaFim ? `, válida até ${state.data.vigenciaFim}` : ""}. Não é alíquota de IPI nem de ICMS.
          </p>
        </>
      )}
    </section>
  );
}
