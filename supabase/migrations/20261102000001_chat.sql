-- Chat du groupe : messages texte, lus par les membres, écrits et supprimés par leur auteur.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index on public.messages (group_id, created_at desc);

grant select, insert, delete on public.messages to authenticated;
alter table public.messages enable row level security;

create policy "messages : lus par le groupe" on public.messages for select to authenticated
  using (public.is_member(group_id));
create policy "messages : j'écris les miens" on public.messages for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(group_id));
create policy "messages : je supprime les miens" on public.messages for delete to authenticated
  using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.messages;
