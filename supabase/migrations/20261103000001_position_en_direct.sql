-- Position en direct : chacun choisit de partager la position de son téléphone (à ~100 m près)
-- au lieu de celle de sa ville. Mise à jour seulement quand l'app est ouverte.
alter table public.profiles
  alter column lat type numeric(6, 3),
  alter column lon type numeric(7, 3),
  add column location_live boolean not null default false,
  add column location_at timestamptz;

-- Les positions des autres arrivent en temps réel sur le globe.
alter publication supabase_realtime add table public.profiles;
