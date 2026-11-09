-- Portal NCM: schema inicial

create extension if not exists pg_trgm with schema extensions;

create table public.ncm_codes (
  codigo       text primary key,
  digits       text not null unique,
  descricao    text not null,
  nivel        smallint not null check (nivel between 0 and 2),
  pai          text references public.ncm_codes (codigo),
  data_inicio  date not null,
  data_fim     date,
  ato          text not null
);

create index ncm_codes_digits_prefix_idx on public.ncm_codes (digits text_pattern_ops);
create index ncm_codes_pai_idx on public.ncm_codes (pai);
create index ncm_codes_descricao_trgm_idx
  on public.ncm_codes using gin (descricao extensions.gin_trgm_ops);

-- Aliquotas oficiais (TIPI/TEC): tabela pronta, preenchida somente com dados de fonte oficial.
create table public.ncm_aliquotas (
  id        bigint generated always as identity primary key,
  codigo    text not null references public.ncm_codes (codigo),
  tributo   text not null check (tributo in ('IPI', 'II')),
  aliquota  numeric(7, 2),
  nota      text,
  fonte     text not null,
  vigencia  date,
  unique (codigo, tributo)
);

create table public.favorites (
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  codigo     text not null references public.ncm_codes (codigo) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, codigo)
);

create table public.search_history (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  termo      text not null check (char_length(termo) between 1 and 80),
  created_at timestamptz not null default now()
);
create index search_history_user_idx on public.search_history (user_id, created_at desc);

-- Mantem no maximo 50 buscas e 500 favoritos por visitante.
create or replace function public.limit_search_history()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.search_history
  where user_id = new.user_id
    and id not in (
      select id from public.search_history
      where user_id = new.user_id order by id desc limit 50
    );
  return null;
end $$;
create trigger search_history_limit
  after insert on public.search_history
  for each row execute function public.limit_search_history();

create or replace function public.limit_favorites()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.favorites where user_id = new.user_id) >= 500 then
    raise exception 'limite de favoritos atingido';
  end if;
  return new;
end $$;
create trigger favorites_limit
  before insert on public.favorites
  for each row execute function public.limit_favorites();

revoke execute on function public.limit_search_history() from public, anon, authenticated;
revoke execute on function public.limit_favorites() from public, anon, authenticated;

-- RLS
alter table public.ncm_codes enable row level security;
alter table public.ncm_aliquotas enable row level security;
alter table public.favorites enable row level security;
alter table public.search_history enable row level security;

create policy "ncm leitura publica" on public.ncm_codes
  for select to anon, authenticated using (true);
create policy "aliquotas leitura publica" on public.ncm_aliquotas
  for select to anon, authenticated using (true);

create policy "favoritos do proprio visitante" on public.favorites
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "historico do proprio visitante" on public.search_history
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- Privilegios minimos
revoke all on public.ncm_codes, public.ncm_aliquotas, public.favorites, public.search_history from anon, authenticated;
grant select on public.ncm_codes, public.ncm_aliquotas to anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, delete on public.search_history to authenticated;
grant usage on sequence public.search_history_id_seq to authenticated;
