-- Photo de profil : chemin du fichier dans le stockage « photos » (<group_id>/<user_id>/avatar-….jpg).
-- Les règles du stockage s'appliquent déjà : le groupe la voit, seule la personne l'envoie ou la supprime.
alter table public.profiles add column avatar_path text check (char_length(avatar_path) <= 200);
