-- Code d'invitation du groupe : l'admin le partage, et toute personne qui le connaît peut créer son compte.
-- Seul l'admin peut le lire ; il n'est créé et changé que côté serveur.

create table public.group_invite_codes (
  group_id uuid primary key references public.groups on delete cascade,
  code text not null unique check (char_length(code) between 6 and 20),
  updated_at timestamptz not null default now()
);

grant select on public.group_invite_codes to authenticated;
alter table public.group_invite_codes enable row level security;

create policy "code d'invitation : l'admin le voit" on public.group_invite_codes for select to authenticated
  using (public.is_group_admin(group_id));
