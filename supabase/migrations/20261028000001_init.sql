-- « Dispo ? » : comptes, groupes, dispos, photos, défis.
-- Règle générale : on lit ce qui appartient à ses groupes, on ne modifie que ses propres lignes.

-- ---------------------------------------------------------------- tables

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  first_name text not null check (char_length(first_name) between 1 and 30),
  color text not null default 'bleu' check (char_length(color) <= 20),
  city text not null default '' check (char_length(city) <= 40),
  timezone text not null default 'Europe/Paris' check (char_length(timezone) <= 60),
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  created_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index on public.group_members (user_id);

create table public.availabilities (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text not null default '' check (char_length(note) <= 80),
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index on public.availabilities (group_id, ends_at);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  path text not null,
  caption text not null default '' check (char_length(caption) <= 120),
  challenge text not null default '' check (char_length(challenge) <= 140),
  -- Date locale de la personne au moment de l'envoi : sert aux flammes.
  local_day date not null,
  created_at timestamptz not null default now()
);
create index on public.photos (group_id, created_at desc);

create table public.photo_reactions (
  photo_id uuid not null references public.photos on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  emoji text not null check (char_length(emoji) <= 8),
  primary key (photo_id, user_id)
);

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  text text not null check (char_length(text) between 3 and 120),
  proposed_by uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- fonctions d'aide

create function public.is_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid());
$$;

create function public.is_group_admin(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members where group_id = gid and user_id = auth.uid() and role = 'admin');
$$;

create function public.shares_group(uid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = uid
  );
$$;

-- Premier lancement : la toute première personne connectée crée le groupe et en devient admin.
-- Ne marche qu'une fois : ensuite, on entre uniquement sur invitation.
create function public.create_first_group() returns uuid
language plpgsql security definer set search_path = '' as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if exists (select 1 from public.groups) then raise exception 'groupe déjà créé'; end if;
  insert into public.groups (name, created_by) values ('Le QG', auth.uid()) returning id into gid;
  insert into public.group_members (group_id, user_id, role) values (gid, auth.uid(), 'admin');
  return gid;
end;
$$;

revoke execute on function public.create_first_group() from public, anon;
grant execute on function public.is_member(uuid), public.is_group_admin(uuid), public.shares_group(uuid),
  public.create_first_group() to authenticated;

-- ---------------------------------------------------------------- droits et RLS

grant select, insert, update, delete on
  public.profiles, public.groups, public.group_members, public.availabilities,
  public.photos, public.photo_reactions, public.challenges
to authenticated;

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.availabilities enable row level security;
alter table public.photos enable row level security;
alter table public.photo_reactions enable row level security;
alter table public.challenges enable row level security;

create policy "profil : moi et mes groupes" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_group(id));
create policy "profil : je crée le mien" on public.profiles for insert to authenticated
  with check (id = (select auth.uid()));
create policy "profil : je modifie le mien" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "groupe : membres" on public.groups for select to authenticated
  using (public.is_member(id));
create policy "groupe : l'admin renomme" on public.groups for update to authenticated
  using (public.is_group_admin(id)) with check (public.is_group_admin(id));

-- Ajouts et retraits de membres : uniquement côté serveur (invitation par l'admin).
create policy "membres : visibles du groupe" on public.group_members for select to authenticated
  using (public.is_member(group_id));

create policy "dispos : lues par le groupe" on public.availabilities for select to authenticated
  using (public.is_member(group_id));
create policy "dispos : j'ajoute les miennes" on public.availabilities for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(group_id));
create policy "dispos : je modifie les miennes" on public.availabilities for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_member(group_id));
create policy "dispos : je retire les miennes" on public.availabilities for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "photos : vues par le groupe" on public.photos for select to authenticated
  using (public.is_member(group_id));
create policy "photos : je poste les miennes" on public.photos for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(group_id));
create policy "photos : je modifie les miennes" on public.photos for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and public.is_member(group_id));
create policy "photos : je supprime les miennes" on public.photos for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "réactions : vues par le groupe" on public.photo_reactions for select to authenticated
  using (exists (select 1 from public.photos p where p.id = photo_id and public.is_member(p.group_id)));
create policy "réactions : j'ajoute la mienne" on public.photo_reactions for insert to authenticated
  with check (user_id = (select auth.uid())
    and exists (select 1 from public.photos p where p.id = photo_id and public.is_member(p.group_id)));
create policy "réactions : je change la mienne" on public.photo_reactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "réactions : je retire la mienne" on public.photo_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "défis : lus par le groupe" on public.challenges for select to authenticated
  using (public.is_member(group_id));
create policy "défis : je propose" on public.challenges for insert to authenticated
  with check (proposed_by = (select auth.uid()) and public.is_member(group_id));
create policy "défis : je retire les miens" on public.challenges for delete to authenticated
  using (proposed_by = (select auth.uid()));

-- ---------------------------------------------------------------- stockage des photos
-- Chemin : <group_id>/<user_id>/<fichier>.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/jpeg', 'image/webp', 'image/png']);

create policy "photos : le groupe les voit" on storage.objects for select to authenticated
  using (bucket_id = 'photos' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "photos : j'envoie dans mon dossier" on storage.objects for insert to authenticated
  with check (bucket_id = 'photos'
    and public.is_member(((storage.foldername(name))[1])::uuid)
    and (storage.foldername(name))[2] = (select auth.uid())::text);
create policy "photos : je supprime les miennes" on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[2] = (select auth.uid())::text);

-- ---------------------------------------------------------------- temps réel

alter publication supabase_realtime add table
  public.availabilities, public.photos, public.photo_reactions, public.challenges;
