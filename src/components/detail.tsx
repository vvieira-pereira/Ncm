"use client";

import { useEffect, useRef, useState } from "react";
import { Aliquotas } from "@/components/aliquotas";
import { IbptBlock } from "@/components/ibpt";
import type { Engine, NcmItem } from "@/lib/search";

type Props = {
  engine: Engine;
  item: NcmItem;
  favorite: boolean;
  onFavorite: () => void;
  onClose: () => void;
  onOpen: (code: string) => void;
};

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function Detail({ engine, item, favorite, onFavorite, onClose, onOpen }: Props) {
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const chain = [...engine.ancestors(item.id), item];
  const kids = engine.children(item.id);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(item.digits);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* sem permissao de area de transferencia */
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-stretch sm:justify-end" role="dialog" aria-modal="true" aria-label={`NCM ${item.codigo}`}>
      <button aria-label="Fechar detalhes" tabIndex={-1} className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <aside className="sheet-in relative flex max-h-[92dvh] w-full pb-[env(safe-area-inset-bottom)] flex-col overflow-y-auto rounded-t-2xl border border-line bg-surface sm:max-h-none sm:w-[min(32rem,60vw)] sm:rounded-none sm:border-y-0 sm:border-r-0">
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div>
            <p className="tag !px-3 !py-1.5 !text-xl">{item.codigo}</p>
            <p className="mt-2 text-sm text-muted">{item.digits.length === 8 ? "Item completo, 8 dígitos" : item.digits.length === 4 ? "Posição" : item.digits.length === 2 ? "Capítulo" : "Subposição"}</p>
          </div>
          <button ref={closeRef} onClick={onClose} className="touch rounded-full border border-line px-4 py-1.5 text-sm hover:bg-bg">
            Fechar
          </button>
        </div>

        <h2 className="px-6 font-display text-xl leading-snug">{item.descricao}</h2>

        <div className="flex flex-wrap gap-2 px-6 py-5">
          <button onClick={copy} className="touch rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent">
            {copied ? "Código copiado" : "Copiar código"}
          </button>
          <button onClick={onFavorite} aria-pressed={favorite} className="touch rounded-full border border-line px-4 py-2 text-sm hover:bg-bg">
            {favorite ? "Remover dos favoritos" : "Salvar nos favoritos"}
          </button>
        </div>
        <p className="sr-only" role="status">{copied ? "Código copiado" : ""}</p>

        <section className="border-t border-line px-6 py-5">
          <h3 className="font-display text-base font-semibold">Onde ele fica na tabela</h3>
          <ol className="mt-3 space-y-1">
            {chain.map((c, i) => (
              <li key={c.id} style={{ paddingLeft: `${i * 14}px` }}>
                <button onClick={() => onOpen(c.codigo)} disabled={c.id === item.id} className="text-left text-sm leading-snug hover:underline disabled:no-underline">
                  <span className="font-medium">{c.codigo}</span> <span className="text-muted">{c.descricao}</span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        {kids.length > 0 && (
          <section className="border-t border-line px-6 py-5">
            <h3 className="font-display text-base font-semibold">Divide-se em {kids.length}</h3>
            <ul className="mt-3 space-y-1">
              {kids.slice(0, 30).map((c) => (
                <li key={c.id}>
                  <button onClick={() => onOpen(c.codigo)} className="text-left text-sm leading-snug hover:underline">
                    <span className="font-medium">{c.codigo}</span> <span className="text-muted">{c.descricao}</span>
                  </button>
                </li>
              ))}
            </ul>
            {kids.length > 30 && <p className="mt-2 text-sm text-muted">e mais {kids.length - 30}. Refine pela busca.</p>}
          </section>
        )}

        <section className="border-t border-line px-6 py-5">
          <h3 className="font-display text-base font-semibold">Base legal</h3>
          <p className="mt-2 text-sm text-muted">
            {item.ato}, em vigor desde {formatDate(item.inicio)}.
          </p>
        </section>

        <IbptBlock codigo={item.codigo} digits={item.digits.length} />

        <section className="border-t border-line px-6 py-5">
          <h3 className="font-display text-base font-semibold">IPI e imposto de importação</h3>
          <Aliquotas codigo={item.codigo} digits={item.digits.length} />
        </section>
      </aside>
    </div>
  );
}
