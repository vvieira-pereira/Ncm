"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Detail } from "@/components/detail";
import { highlight } from "@/lib/highlight";
import { createEngine, type Engine, type IndexFile, type NcmItem } from "@/lib/search";
import { addHistory, clearHistory, loadUserData, setFavorite } from "@/lib/user-data";

const EXAMPLES = ["camiseta de algodão", "pneu", "celular", "café torrado", "8517", "cadeira"];
type Tab = "busca" | "favoritos" | "recentes";

function Marked({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlight(text, query).map((p, i) =>
        p.hit ? (
          <mark key={i} className="hit">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export default function Home() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [atualizacao, setAtualizacao] = useState("");
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [tab, setTab] = useState<Tab>("busca");
  const [openId, setOpenId] = useState<number | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/ncm-index.json")
      .then((r) => {
        if (!r.ok) throw new Error("falha");
        return r.json() as Promise<IndexFile>;
      })
      .then((d) => {
        if (!alive) return;
        setEngine(createEngine(d));
        setAtualizacao(d.atualizacao);
      })
      .catch(() => alive && setLoadError(true));
    loadUserData().then((u) => {
      if (!alive) return;
      setFavorites(u.favorites);
      setHistory(u.history);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "/" && tag !== "INPUT" && tag !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => (engine ? engine.search(deferred) : []), [engine, deferred]);
  const favItems = useMemo(
    () => (engine ? favorites.map((c) => engine.byCode.get(c)).filter((x): x is number => x !== undefined).map((i) => engine.items[i]) : []),
    [engine, favorites],
  );
  const list: NcmItem[] = tab === "favoritos" ? favItems : results;
  const open = engine && openId !== null ? engine.items[openId] : null;

  const commitSearch = useCallback(
    (term: string) => {
      addHistory(term, history).then(setHistory);
    },
    [history],
  );

  function openItem(item: NcmItem) {
    setOpenId(item.id);
    if (tab === "busca" && query.trim()) commitSearch(query);
  }

  async function toggleFavorite(item: NcmItem) {
    const on = !favorites.includes(item.codigo);
    setFavorites(await setFavorite(item.codigo, on, favorites));
  }

  function runTerm(term: string) {
    setQuery(term);
    setTab("busca");
    inputRef.current?.focus();
  }

  const searching = deferred.trim().length > 0;

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col px-5 sm:px-8">
      <header className="flex items-center justify-between py-6">
        <span className="font-display text-lg font-semibold tracking-tight">Portal NCM</span>
        <nav className="text-sm text-muted">
          <Link href="/sobre/" prefetch={false} className="hover:text-ink hover:underline">
            Sobre e fontes
          </Link>
        </nav>
      </header>

      <main className="flex-1 pb-16">
        <section className="pt-8 sm:pt-14">
          <h1 className="max-w-[16ch] font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl">
            Descubra o NCM do seu produto
          </h1>
          <p className="mt-5 max-w-[46ch] text-base leading-relaxed text-muted sm:text-lg">
            Digite o nome da mercadoria ou parte do código. A tabela inteira roda no seu aparelho, sem planilha para baixar.
          </p>

          <div className="mt-9">
            <label htmlFor="busca" className="sr-only">
              Buscar por descrição ou código NCM
            </label>
            <input
              id="busca"
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value.slice(0, 80))}
              onKeyDown={(e) => e.key === "Enter" && query.trim() && commitSearch(query)}
              placeholder="Ex.: camiseta de algodão ou 6109"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="search"
              enterKeyHint="search"
              autoFocus
              className="peer w-full rounded-none bg-transparent py-3 font-display text-2xl outline-none placeholder:text-muted/60 focus-visible:outline-none sm:text-3xl"
            />
            <div className="draw h-[3px] bg-ink peer-focus-visible:bg-accent" />
            <p className="mt-3 min-h-5 text-sm text-muted" aria-live="polite">
              {loadError
                ? "Não foi possível carregar a tabela. Recarregue a página."
                : !engine
                  ? "Carregando a tabela…"
                  : searching && tab === "busca"
                    ? results.length === 0
                      ? "Nada encontrado. Tente outra palavra ou só os primeiros números do código."
                      : `${results.length}${results.length === 80 ? "+" : ""} resultado${results.length === 1 ? "" : "s"}`
                    : atualizacao}
            </p>
          </div>

          {!searching && (
            <div className="mt-5 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} onClick={() => runTerm(ex)} className="rounded-full border border-line px-3.5 py-1.5 text-sm hover:border-ink">
                  {ex}
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="mt-12">
          <div role="tablist" aria-label="Seções" className="flex gap-6 border-b border-line text-sm">
            {(
              [
                ["busca", "Busca"],
                ["favoritos", `Favoritos${favorites.length ? ` (${favorites.length})` : ""}`],
                ["recentes", "Recentes"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`-mb-px border-b-2 pb-3 ${tab === id ? "border-ink font-semibold" : "border-transparent text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "recentes" ? (
            <div className="py-5">
              {history.length === 0 ? (
                <p className="py-6 text-muted">Suas buscas aparecem aqui depois que você abrir um resultado.</p>
              ) : (
                <>
                  <ul>
                    {history.map((h) => (
                      <li key={h}>
                        <button onClick={() => runTerm(h)} className="row w-full border-b border-line py-3 text-left">
                          {h}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    onClick={() => {
                      clearHistory();
                      setHistory([]);
                    }}
                    className="mt-4 text-sm text-muted underline hover:text-ink"
                  >
                    Limpar recentes
                  </button>
                </>
              )}
            </div>
          ) : (
            <ul className="mt-1">
              {tab === "favoritos" && list.length === 0 && (
                <li className="py-8 text-muted">Nenhum favorito ainda. Abra um código e escolha “Salvar nos favoritos”.</li>
              )}
              {tab === "busca" && !searching && engine && (
                <li className="py-8 text-muted">Os resultados aparecem enquanto você digita.</li>
              )}
              {list.map((item) => {
                const trail = engine!.ancestors(item.id).slice(-1).map((a) => a.descricao).join(" › ");
                return (
                  <li key={item.id}>
                    <button onClick={() => openItem(item)} className="row grid w-full grid-cols-[7.2rem_1fr] items-start gap-4 border-b border-line px-1 py-4 text-left sm:grid-cols-[8rem_1fr]">
                      <span className="tag px-2.5 py-1.5 text-center font-display text-[15px] font-semibold">
                        <Marked text={item.codigo} query={tab === "busca" ? "" : ""} />
                      </span>
                      <span>
                        <span className="block leading-snug">
                          <Marked text={item.descricao} query={tab === "busca" ? deferred : ""} />
                        </span>
                        {trail && <span className="mt-1 line-clamp-2 text-sm leading-snug text-muted">{trail}</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <footer className="border-t border-line py-6 text-sm text-muted">
        Consulta informativa. Confirme a classificação com seu contador antes de emitir notas.
      </footer>

      {open && engine && (
        <Detail
          engine={engine}
          item={open}
          favorite={favorites.includes(open.codigo)}
          onFavorite={() => toggleFavorite(open)}
          onClose={() => setOpenId(null)}
          onOpen={(code) => {
            const id = engine.byCode.get(code);
            if (id !== undefined) setOpenId(id);
          }}
        />
      )}
    </div>
  );
}
