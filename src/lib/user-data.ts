import { ensureAnonymous, getSupabase } from "./supabase";

const FAV_KEY = "ncm:favoritos";
const HIST_KEY = "ncm:historico";

function readLocal(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeLocal(key: string, v: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* armazenamento indisponivel: segue so em memoria */
  }
}

/** Carrega favoritos e historico: banco (sessao anonima) com copia local como reserva. */
export async function loadUserData(): Promise<{ favorites: string[]; history: string[]; synced: boolean }> {
  const favorites = readLocal(FAV_KEY);
  const history = readLocal(HIST_KEY);
  try {
    const sb = getSupabase();
    if (!sb) return { favorites, history, synced: false };
    const { data } = await sb.auth.getSession();
    if (!data.session) return { favorites, history, synced: false };
    const [f, h] = await Promise.all([
      sb.from("favorites").select("codigo").order("created_at", { ascending: false }),
      sb.from("search_history").select("termo").order("id", { ascending: false }).limit(20),
    ]);
    if (f.error || h.error) return { favorites, history, synced: false };
    const fav = f.data.map((r) => r.codigo as string);
    const his = [...new Set(h.data.map((r) => r.termo as string))];
    writeLocal(FAV_KEY, fav);
    writeLocal(HIST_KEY, his);
    return { favorites: fav, history: his, synced: true };
  } catch {
    return { favorites, history, synced: false };
  }
}

export async function setFavorite(codigo: string, on: boolean, current: string[]): Promise<string[]> {
  const next = on ? [codigo, ...current.filter((c) => c !== codigo)] : current.filter((c) => c !== codigo);
  writeLocal(FAV_KEY, next);
  try {
    if (await ensureAnonymous()) {
      const sb = getSupabase()!;
      if (on) await sb.from("favorites").upsert({ codigo }, { onConflict: "user_id,codigo", ignoreDuplicates: true });
      else await sb.from("favorites").delete().eq("codigo", codigo);
    }
  } catch {
    /* mantem a copia local */
  }
  return next;
}

export async function addHistory(termo: string, current: string[]): Promise<string[]> {
  const t = termo.trim().slice(0, 80);
  if (t.length < 2) return current;
  const next = [t, ...current.filter((x) => x !== t)].slice(0, 20);
  writeLocal(HIST_KEY, next);
  try {
    if (await ensureAnonymous()) await getSupabase()!.from("search_history").insert({ termo: t });
  } catch {
    /* mantem a copia local */
  }
  return next;
}

export async function clearHistory(): Promise<void> {
  writeLocal(HIST_KEY, []);
  try {
    const sb = getSupabase();
    if (sb && (await sb.auth.getSession()).data.session) {
      const uid = (await sb.auth.getUser()).data.user?.id;
      if (uid) await sb.from("search_history").delete().eq("user_id", uid);
    }
  } catch {
    /* ignora */
  }
}
