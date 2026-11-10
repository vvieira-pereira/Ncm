"use client";

import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Detail } from "@/components/detail";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { highlight } from "@/lib/highlight";
import { createEngine, type Engine, type IndexFile, type NcmItem } from "@/lib/search";
import { addHistory, clearHistory, loadUserData, setFavorite } from "@/lib/user-data";

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
  const showList = tab !== "recentes";

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="safe-x flex items-center justify-between py-4 sm:px-8 sm:py-6 lg:px-12">
        <Link href="/" aria-label="Portal NCM, início" className="group flex items-center">
          <Logo size={46} />
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/sobre/" prefetch={false} className="text-sm text-muted hover:text-ink">
            Sobre e fontes
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="safe-x mx-auto flex w-full max-w-2xl flex-1 flex-col md:max-w-[44rem]">
      <main className="flex-1 pb-16">
        <section className="hero-pad pb-7 pt-6 text-center sm:pt-10 lg:pt-14">
          <h1 className="text-[1.75rem] font-semibold leading-tight tracking-tight text-balance min-[380px]:text-[2rem] sm:text-[2.6rem] lg:text-5xl">Encontre o NCM do seu produto</h1>
          <p className="mx-auto mt-3 max-w-[40ch] text-[0.95rem] leading-relaxed text-muted sm:text-[1.0625rem]">
            Pesquise pelo nome da mercadoria ou por parte do código. Rápido, sem planilha.
          </p>

          <div className="relative mt-7 text-left sm:mt-9">
            <label htmlFor="busca" className="sr-only">
              Buscar por item ou código NCM
            </label>
            <svg aria-hidden viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              id="busca"
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value.slice(0, 80));
                setTab("busca");
              }}
              onKeyDown={(e) => e.key === "Enter" && query.trim() && commitSearch(query)}
              placeholder="Digite aqui seu item ou código NCM"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="search"
              enterKeyHint="search"
              autoFocus
              className="field h-14 w-full rounded-2xl border border-line bg-surface pl-12 pr-12 text-base sm:h-[3.75rem] sm:text-[1.0625rem] text-ink placeholder:text-muted/70"
            />
            {query && (
              <button
                type="button"
                aria-label="Limpar busca"
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="touch absolute right-2.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-bg hover:text-ink"
              >
                <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            )}
          </div>

          <p className="mt-3 min-h-5 text-center text-sm text-muted" aria-live="polite">
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

        </section>

        <section>
          <div role="tablist" aria-label="Seções" className="mb-4 flex gap-1 rounded-xl bg-line/60 p-1 text-sm sm:text-base">
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
                className={`touch flex-1 rounded-lg px-2 py-2.5 transition-colors sm:px-3 ${tab === id ? "bg-surface font-medium text-ink shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "recentes" ? (
            <div className="rounded-2xl border border-line bg-surface">
              {history.length === 0 ? (
                <p className="p-6 text-center text-muted">Suas buscas aparecem aqui depois que você abrir um resultado.</p>
              ) : (
                <>
                  <ul className="divide-y divide-line">
                    {history.map((h) => (
                      <li key={h}>
                        <button onClick={() => runTerm(h)} className="row w-full px-5 py-3.5 text-left">
                          {h}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-line px-5 py-3">
                    <button
                      onClick={() => {
                        clearHistory();
                        setHistory([]);
                      }}
                      className="text-sm text-muted hover:text-ink"
                    >
                      Limpar recentes
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            showList && (
              <>
                {tab === "favoritos" && list.length === 0 && (
                  <p className="rounded-2xl border border-line bg-surface p-6 text-center text-muted">
                    Nenhum favorito ainda. Abra um código e escolha “Salvar nos favoritos”.
                  </p>
                )}
                {tab === "busca" && !searching && engine && (
                  <p className="p-4 text-center text-sm text-muted">Os resultados aparecem enquanto você digita.</p>
                )}
                {list.length > 0 && (
                  <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                    {list.map((item) => {
                      const trail = engine!.ancestors(item.id).slice(-1).map((a) => a.descricao).join("");
                      return (
                        <li key={item.id}>
                          <button onClick={() => openItem(item)} className="row flex w-full items-start gap-3 px-3 py-3.5 text-left min-[400px]:gap-4 min-[400px]:px-4 sm:px-5">
                            <span className="tag mt-0.5 shrink-0">{item.codigo}</span>
                            <span className="min-w-0">
                              <span className="block leading-snug">
                                <Marked text={item.descricao} query={tab === "busca" ? deferred : ""} />
                              </span>
                              {trail && <span className="mt-1 line-clamp-2 text-[0.8125rem] leading-snug text-muted">{trail}</span>}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            )
          )}
        </section>
      </main>

      <footer className="safe-b border-t border-line pt-6 text-center text-sm text-muted">
        Consulta informativa. Confirme a classificação com seu contador antes de emitir notas.
      </footer>
      </div>

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
