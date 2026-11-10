"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

type Row = { tributo: "IPI" | "II"; aliquota: number | null; nota: string | null; fonte: string; vigencia: string | null };
type State = { status: "loading" } | { status: "error" } | { status: "ok"; rows: Row[] };

const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const br = (iso: string) => iso.split("-").reverse().join("/");

function Line({ label, row }: { label: string; row?: Row }) {
  let value: React.ReactNode;
  if (!row) value = <span className="text-muted">Sem dado nesta base</span>;
  else if (row.aliquota === null && row.nota === "NT") value = <span>NT, não tributado</span>;
  else if (row.aliquota !== null) value = <span className="font-semibold">{pct(row.aliquota)}</span>;
  else value = <span className="text-muted">Sem dado nesta base</span>;
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5 last:border-b-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-right text-sm">
        {value}
        {row?.aliquota !== null && row?.nota && row.nota !== "NT" && <span className="mt-0.5 block text-[0.8125rem] text-muted">{row.nota}</span>}
      </dd>
    </div>
  );
}

/** Aliquotas de IPI e II do item (8 digitos), lidas do banco. Ausencia de dado nunca vira zero. */
export function Aliquotas({ codigo, digits }: { codigo: string; digits: number }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (digits !== 8) return;
    let alive = true;
    const sb = getSupabase();
    if (!sb) {
      setState({ status: "error" });
      return;
    }
    setState({ status: "loading" });
    sb.from("ncm_aliquotas")
      .select("tributo,aliquota,nota,fonte,vigencia")
      .eq("codigo", codigo)
      .then(({ data, error }) => {
        if (!alive) return;
        setState(error || !data ? { status: "error" } : { status: "ok", rows: data as Row[] });
      });
    return () => {
      alive = false;
    };
  }, [codigo, digits]);

  if (digits !== 8) {
    return <p className="mt-2 text-sm text-muted">As alíquotas valem para o item de 8 dígitos. Abra um dos itens abaixo desta posição.</p>;
  }
  if (state.status === "loading") return <p className="mt-2 text-sm text-muted" aria-live="polite">Buscando alíquotas…</p>;
  if (state.status === "error") {
    return <p className="mt-2 text-sm text-muted">Não foi possível carregar as alíquotas agora. Confira na TIPI (IPI) e na TEC (imposto de importação).</p>;
  }

  const ipi = state.rows.find((r) => r.tributo === "IPI");
  const ii = state.rows.find((r) => r.tributo === "II");
  const vig = ipi?.vigencia ?? ii?.vigencia;

  return (
    <>
      <dl className="mt-2">
        <Line label="IPI" row={ipi} />
        <Line label="Imposto de importação (II)" row={ii} />
      </dl>
      <p className="mt-3 text-[0.8125rem] leading-relaxed text-muted">
        Fontes: TIPI (Receita Federal) e TEC (Gecex/MDIC), reunidas por{" "}
        <a href="https://tabelasfiscais.com.br" target="_blank" rel="noopener noreferrer" className="underline hover:text-ink">
          tabelasfiscais.com.br
        </a>
        {vig ? `, dados de ${br(vig)}` : ""}. “Sem dado nesta base” não quer dizer alíquota zero. Valores informativos, sem garantia: confirme nas fontes oficiais antes de decidir.
      </p>
    </>
  );
}
