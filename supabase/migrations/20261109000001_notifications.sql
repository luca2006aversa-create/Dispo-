-- Abonnements aux notifications (un par téléphone ou navigateur).
-- Écrits et lus uniquement par le serveur de l'app (clé secrète) : aucune règle d'accès publique.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
