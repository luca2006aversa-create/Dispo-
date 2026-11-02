-- Projets de vacances : propositions de lieux (photos, « Ça me tente », commentaires), semaines libres,
-- checklist « qui ramène quoi », dépenses partagées, sondages et album du voyage.
-- Tout est lu par les membres du groupe ; chacun ne retire que ce qu'il a ajouté.
-- Le choix final, les dates et la checklist sont modifiables par tous les membres.

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  title text not null check (char_length(title) between 1 and 60),
  starts_on date,
  ends_on date,
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);
create index on public.projects (group_id);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  place text not null check (char_length(place) between 1 and 80),
  lat numeric(6, 2),
  lon numeric(6, 2),
  info text not null default '' check (char_length(info) <= 2000),
  link text not null default '' check (char_length(link) <= 300),
  created_at timestamptz not null default now()
);
create index on public.proposals (project_id);

-- Le lieu choisi (« On part là ! »).
alter table public.projects add column chosen_proposal uuid references public.proposals on delete set null;

create table public.proposal_photos (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);

create table public.proposal_votes (
  proposal_id uuid not null references public.proposals on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  primary key (proposal_id, user_id)
);

create table public.proposal_comments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references public.proposals on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

-- Semaines où chacun est libre (lundi de la semaine).
create table public.project_weeks (
  project_id uuid not null references public.projects on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  week_start date not null,
  primary key (project_id, user_id, week_start)
);

create table public.project_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  label text not null check (char_length(label) between 1 and 100),
  assignee uuid references auth.users on delete set null,
  done boolean not null default false,
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

-- Dépenses : partagées (divisées entre tous) ou perso (son propre transport, pour le coût par personne).
create table public.project_expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  paid_by uuid not null default auth.uid() references auth.users on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  amount_cents integer not null check (amount_cents > 0 and amount_cents < 100000000),
  shared boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.polls (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects on delete cascade,
  question text not null check (char_length(question) between 1 and 120),
  options text[] not null check (cardinality(options) between 2 and 6),
  created_by uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now()
);

create table public.poll_votes (
  poll_id uuid not null references public.polls on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  choice smallint not null check (choice between 0 and 5),
  primary key (poll_id, user_id)
);

-- Album du voyage : une photo du fil peut être rangée dans un projet.
alter table public.photos add column project_id uuid references public.projects on delete set null;

-- ---------------------------------------------------------------- fonctions d'aide

create function public.project_group(pid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select group_id from public.projects where id = pid;
$$;

create function public.proposal_group(pid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.group_id from public.proposals x join public.projects p on p.id = x.project_id where x.id = pid;
$$;

create function public.poll_group(pid uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select p.group_id from public.polls x join public.projects p on p.id = x.project_id where x.id = pid;
$$;

grant execute on function public.project_group(uuid), public.proposal_group(uuid), public.poll_group(uuid) to authenticated;

-- ---------------------------------------------------------------- droits et RLS

grant select, insert, update, delete on
  public.projects, public.proposals, public.proposal_photos, public.proposal_votes, public.proposal_comments,
  public.project_weeks, public.project_items, public.project_expenses, public.polls, public.poll_votes
to authenticated;

alter table public.projects enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_photos enable row level security;
alter table public.proposal_votes enable row level security;
alter table public.proposal_comments enable row level security;
alter table public.project_weeks enable row level security;
alter table public.project_items enable row level security;
alter table public.project_expenses enable row level security;
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;

create policy "projets : lus par le groupe" on public.projects for select to authenticated
  using (public.is_member(group_id));
create policy "projets : un membre en crée" on public.projects for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_member(group_id));
create policy "projets : le groupe fixe dates et choix" on public.projects for update to authenticated
  using (public.is_member(group_id)) with check (public.is_member(group_id));
create policy "projets : le créateur supprime" on public.projects for delete to authenticated
  using (created_by = (select auth.uid()));

create policy "propositions : lues par le groupe" on public.proposals for select to authenticated
  using (public.is_member(public.project_group(project_id)));
create policy "propositions : j'ajoute les miennes" on public.proposals for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(public.project_group(project_id)));
create policy "propositions : je modifie les miennes" on public.proposals for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "propositions : je supprime les miennes" on public.proposals for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "photos de lieux : lues par le groupe" on public.proposal_photos for select to authenticated
  using (public.is_member(public.proposal_group(proposal_id)));
create policy "photos de lieux : j'ajoute les miennes" on public.proposal_photos for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(public.proposal_group(proposal_id)));
create policy "photos de lieux : je retire les miennes" on public.proposal_photos for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "ça me tente : lu par le groupe" on public.proposal_votes for select to authenticated
  using (public.is_member(public.proposal_group(proposal_id)));
create policy "ça me tente : le mien" on public.proposal_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(public.proposal_group(proposal_id)));
create policy "ça me tente : je le retire" on public.proposal_votes for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "commentaires : lus par le groupe" on public.proposal_comments for select to authenticated
  using (public.is_member(public.proposal_group(proposal_id)));
create policy "commentaires : j'écris les miens" on public.proposal_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(public.proposal_group(proposal_id)));
create policy "commentaires : je supprime les miens" on public.proposal_comments for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "semaines : lues par le groupe" on public.project_weeks for select to authenticated
  using (public.is_member(public.project_group(project_id)));
create policy "semaines : je coche les miennes" on public.project_weeks for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(public.project_group(project_id)));
create policy "semaines : je décoche les miennes" on public.project_weeks for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "checklist : lue par le groupe" on public.project_items for select to authenticated
  using (public.is_member(public.project_group(project_id)));
create policy "checklist : un membre ajoute" on public.project_items for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_member(public.project_group(project_id)));
create policy "checklist : le groupe coche et attribue" on public.project_items for update to authenticated
  using (public.is_member(public.project_group(project_id))) with check (public.is_member(public.project_group(project_id)));
create policy "checklist : le groupe retire" on public.project_items for delete to authenticated
  using (public.is_member(public.project_group(project_id)));

create policy "dépenses : lues par le groupe" on public.project_expenses for select to authenticated
  using (public.is_member(public.project_group(project_id)));
create policy "dépenses : j'ajoute ce que j'ai payé" on public.project_expenses for insert to authenticated
  with check (paid_by = (select auth.uid()) and public.is_member(public.project_group(project_id)));
create policy "dépenses : je retire les miennes" on public.project_expenses for delete to authenticated
  using (paid_by = (select auth.uid()));

create policy "sondages : lus par le groupe" on public.polls for select to authenticated
  using (public.is_member(public.project_group(project_id)));
create policy "sondages : un membre en crée" on public.polls for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_member(public.project_group(project_id)));
create policy "sondages : je supprime les miens" on public.polls for delete to authenticated
  using (created_by = (select auth.uid()));

create policy "votes : lus par le groupe" on public.poll_votes for select to authenticated
  using (public.is_member(public.poll_group(poll_id)));
create policy "votes : je vote" on public.poll_votes for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_member(public.poll_group(poll_id)));
create policy "votes : je change mon vote" on public.poll_votes for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "votes : je retire mon vote" on public.poll_votes for delete to authenticated
  using (user_id = (select auth.uid()));

-- Une photo du fil ne peut être rangée que dans un projet de son groupe.
alter table public.photos add constraint photos_projet_du_groupe
  check (project_id is null or public.project_group(project_id) = group_id);

-- ---------------------------------------------------------------- temps réel

alter publication supabase_realtime add table
  public.projects, public.proposals, public.proposal_photos, public.proposal_votes, public.proposal_comments,
  public.project_weeks, public.project_items, public.project_expenses, public.polls, public.poll_votes;
