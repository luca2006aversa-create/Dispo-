-- Position de chaque personne sur le globe : celle de sa ville, arrondie (environ 1 km), jamais sa position exacte.
alter table public.profiles
  add column lat numeric(6, 2) check (lat between -90 and 90),
  add column lon numeric(6, 2) check (lon between -180 and 180);
