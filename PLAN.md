# « Dispo ? » : plan de construction

Proposition à valider avant d'écrire du code. Le prototype `trio-dispo.html` sert de référence pour le design, les textes et les défis.

## 1. Stack

| Brique | Choix | Pourquoi |
|---|---|---|
| Front | Next.js (App Router) + TypeScript + Tailwind | Comme demandé. Rendu serveur pour l'accueil, composants client pour le temps réel. |
| Données | Supabase : Postgres + RLS, Storage (photos), Realtime | Tout dans l'offre gratuite. |
| Connexion | Supabase Auth, **code à 6 chiffres envoyé par e-mail** (le lien reste dans le mail en secours) | Sur iPhone, un lien magique ouvre Safari, pas l'app installée : la session ne passe pas dans la PWA. Un code tapé dans l'app évite ce piège. |
| E-mails | SMTP externe gratuit branché sur Supabase (Brevo, 300 mails/jour, sans nom de domaine) | Le service d'e-mail par défaut de Supabase n'envoie qu'aux membres de l'équipe Supabase et est très limité. |
| Hébergement | Vercel (offre Hobby) | Gratuit pour un usage perso. |
| PWA | `app/manifest.ts` + service worker écrit à la main (`public/sw.js`) | Installable, icône, écran hors ligne minimal, réception des push. Pas de dépendance PWA fragile. |
| Notifications | Web Push (clés VAPID, lib `web-push`) envoyées par des routes Next.js | Sur iPhone : seulement si l'app est installée sur l'écran d'accueil (iOS 16.4+). |
| Tâches planifiées | `pg_cron` + `pg_net` dans Supabase appellent toutes les heures `/api/cron/...` sur Vercel (protégé par un secret) | Les crons Vercel gratuits ne tournent qu'une fois par jour, or « le soir » n'est pas à la même heure à Hanoï et à Toulouse. |
| Tests | Vitest (logique pure) ; tests RLS en SQL en option | Fuseaux, créneaux communs, flammes. |
| Dates | `Intl` + `date-fns-tz` | Conversions fiables entre fuseaux, heure d'été comprise. |

Pas de Docker nécessaire : on travaille directement sur un projet Supabase hébergé, les migrations sont envoyées avec `supabase db push`.

## 2. Modèle de données (Postgres)

Toutes les tables ont la RLS activée. Deux fonctions d'aide `security definer` : `is_member(group_id)` et `shares_group(user_id)`.

**Comptes et groupes**
- `profiles` : id (= auth.users), prénom, couleur, ville, fuseau (IANA), is_admin, créé le.
- `groups` : id, nom, créé par.
- `group_members` : group_id, user_id, rôle (admin / membre), rejoint le.
- `invitations` : group_id, e-mail, invité par, acceptée le. L'inscription libre est coupée ; seul un e-mail invité peut recevoir un code.

**Dispos et planning**
- `availabilities` : user_id, group_id, `starts_at` / `ends_at` en timestamptz (UTC), note. Saisie dans le fuseau de la personne, convertie à l'enregistrement.
- `schedule_items` : user_id, jour (0 = lundi), début, fin (heure murale), titre, niveau (`pas_touche` / `ca_depend` / `derange_moi`). Interprété dans le fuseau du profil, donc l'heure d'été ne casse rien.

**Photos, défis, flammes**
- `challenges` : texte, catégorie, origine (banque / proposé), proposé par. Banque de départ ≥ 300 défis chargée par migration.
- `photos` : user_id, group_id, chemin dans le Storage, légende, défi (id + texte figé), **jour local** de la personne au moment de l'envoi, créée le.
- `photo_reactions` : photo_id, user_id, emoji (une réaction par personne et par photo).
- Les flammes ne sont pas stockées : elles se calculent à partir des jours locaux des photos.

**Projets de vacances**
- `projects` : group_id, titre, dates, proposition choisie (null tant que rien n'est décidé), créé par.
- `proposals` : project_id, user_id, lieu, transport, logement, budget, activités, notes libres, liens.
- `proposal_photos` (plusieurs par proposition), `proposal_votes` (« Ça me tente »), `proposal_comments`.
- Mode organisation : `project_tasks` (checklist, avec « qui ramène quoi » = tâche assignée) et `project_expenses` (budget partagé, bonus).
- `reunions` : retrouvailles hors projet (« Noël à la maison »), pour le compte à rebours.

**Notifications**
- `push_subscriptions` : user_id, endpoint, clés.
- `notification_log` : évite d'envoyer deux fois la même alerte (créneau déjà signalé, rappel de flamme du jour).

**Règles RLS** : on lit ce qui appartient à un groupe dont on est membre (et le planning des personnes avec qui on partage un groupe) ; on n'insère, ne modifie et ne supprime que ses propres lignes. Exceptions : le choix final d'un projet et la checklist sont modifiables par tous les membres du groupe ; les invitations sont réservées aux admins. Le bucket photos est privé, rangé par `group_id/…`, avec des règles Storage équivalentes.

## 3. Logique délicate (testée)

- **Créneaux communs** : on découpe la ligne du temps aux bornes de toutes les dispos, on garde chaque segment où au moins deux personnes sont libres, on fusionne les segments contigus avec le même groupe de personnes, puis on ne garde que ceux de 15 min ou plus. Les créneaux « tout le monde » passent en tête.
- **Fuseaux** : tout est stocké en UTC ; affichage « 20h00 chez toi · 14h00 chez Gaïa ». Tests sur les changements d'heure (fin octobre, fin mars) et sur Hanoï (UTC+7, sans heure d'été).
- **Flammes** : série de jours locaux consécutifs avec au moins une photo ; elle reste « vivante » jusqu'à la fin de la journée locale suivante. **Flamme du groupe** : nombre de dates consécutives où chaque membre a posté sur sa propre date locale ; un membre ne compte qu'à partir du jour où il a rejoint le groupe.
- **Défi du jour** : tiré au sort de façon déterministe à partir de la date. Chacun reçoit le défi de sa date locale : tout le monde a le même défi « du 28 octobre », Luca le découvre juste 5 ou 6 heures plus tôt.

## 4. Écrans

Barre d'onglets en bas : **Accueil · Dispos · Planning · Photos · Projets**. Un menu profil en haut à droite donne accès aux réglages.

- `/connexion` : e-mail, puis code à 6 chiffres.
- `/bienvenue` (première connexion) : prénom, couleur, ville, fuseau détecté (modifiable).
- `/` Accueil : mot d'anniversaire (le 28 octobre, et à la première ouverture de Gaïa), flammes, défi du jour, « En ce moment », prochain créneau commun, compte à rebours.
- `/dispos` : formulaire « le … de … à … », créneaux communs, toutes les dispos à venir.
- `/planning` : choix de la personne et du jour, liste, ajout (avec « du lundi au vendredi ») uniquement sur son propre planning.
- `/photos` : poster (défi, sans défi, autre défi), proposer un défi, fil de polaroids avec réactions.
- `/projets` et `/projets/[id]` : propositions concurrentes, « Ça me tente », commentaires, « On part là ! », puis mode organisation.
- `/reglages` : profil, thème (auto / clair / sombre), notifications, et pour l'admin : inviter quelqu'un, gérer le groupe.

Design repris du prototype : fond `#EEF2F7`, encre `#14213D`, flamme `#FF6B3D`, une couleur par personne (palette de 8 au choix), Bricolage Grotesque + Caveat via `next/font`, mode sombre complet, focus orange visible, cibles tactiles ≥ 44 px. Le mot « trio » devient « groupe ».

## 5. Étapes (une version qui marche à chaque fois)

0. **Squelette** : dépôt Git, Next.js + Tailwind avec les couleurs du prototype, polices, barre d'onglets, mode sombre, manifest PWA et icônes. Premier déploiement Vercel.
1. **Comptes** : migrations profils, groupes, invitations + RLS ; connexion par code ; écran de bienvenue ; page admin pour inviter.
2. **Dispos** : saisie, conversion des fuseaux, créneaux communs, temps réel. Tests fuseaux et créneaux.
3. **Planning** : emplois du temps et « En ce moment » (dont « sûrement en train de dormir »).
4. **Photos** : compression côté client (côté long 1600 px, environ 300 Ko), Storage privé, fil polaroid, réactions, banque de 300+ défis classés, proposition de défis, flammes. Tests des flammes.
5. **Accueil** complet : anniversaire, flammes, défi, prochain créneau, compte à rebours.
6. **Projets de vacances** : propositions, photos, votes, commentaires, choix final, checklist, « qui ramène quoi », budget partagé.
7. **Notifications push** : nouveau créneau commun, « ta flamme va s'éteindre » vers 20 h locales, cron horaire.
8. **Finitions** : README débutant pas à pas, passe accessibilité, dernière relecture des RLS.

Un commit clair par étape (ou plus), dans un dépôt Git propre.

## 6. Version de ce soir (28 octobre)

Objectif : une app en ligne que Gaïa peut ouvrir et installer ce soir, puis on peaufine sur plusieurs semaines.

**Dans la version de ce soir** : étapes 0 et 1 (squelette, connexion par code, invitations), un accueil avec le mot d'anniversaire, les flammes, le défi du jour et « En ce moment » (heure locale de chacun, et « sûrement en train de dormir » la nuit), les dispos avec les créneaux communs, et les photos (défis, polaroids, réactions, flammes).

**Pour les semaines suivantes** : planning, compte à rebours, projets de vacances, notifications push, banque complète de 300+ défis (ce soir : celle du prototype, environ 110), finitions et README détaillé.

**À faire par Luca en parallèle** (je ne peux pas créer de comptes à ta place) :
1. Créer un compte GitHub (si besoin) et un compte Vercel connecté à GitHub.
2. Créer un projet Supabase (région Europe, Paris ou Francfort) et noter l'URL du projet, la clé `anon` et la clé `service_role`.
3. Créer un compte Brevo, vérifier ton adresse d'expéditeur, générer une clé SMTP.

Choix validés : connexion par code à 6 chiffres, e-mails via Brevo, compte à rebours = projets décidés + dates libres.
