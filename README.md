# Dispo ?

Le QG de Gaïa, Emma, Luca et compagnie : on dit quand on est dispo, on trouve les créneaux communs malgré les fuseaux horaires, on relève le défi photo du jour et on garde la flamme.

Application web installable sur iPhone et Android (PWA), construite avec Next.js, Supabase et Vercel, dans les offres gratuites.

---

## Mettre l'app en ligne, pas à pas

Compte environ 45 minutes la première fois. Tu n'as besoin de rien installer de plus que ce qui est déjà sur ton ordinateur.

### 1. Créer la base de données (Supabase)

1. Va sur [supabase.com](https://supabase.com), crée un compte puis **New project**.
   - Nom : `dispo`. Mot de passe de la base : génère-le et garde-le dans un coin.
   - Région : **West EU (Paris)** ou **Central EU (Frankfurt)**.
2. Une fois le projet prêt, ouvre **SQL Editor** (menu de gauche), clique **New query**, colle tout le contenu du fichier
   `supabase/migrations/20261028000001_init.sql`, puis **Run**. Tu dois voir « Success ». Cela crée les tables, les règles de sécurité et l'espace de stockage des photos.
3. Ouvre **Project Settings > API Keys** et note :
   - l'**URL du projet** (`https://xxxx.supabase.co`, aussi dans **Project Settings > Data API**) ;
   - la **Publishable key** (`sb_publishable_…`) ;
   - la **Secret key** (`sb_secret_…`). Celle-ci ne se partage jamais.

### 2. Brancher l'envoi des e-mails (Brevo)

Le service d'e-mail par défaut de Supabase n'écrit qu'aux membres de ton équipe Supabase : il faut le tien.

1. Crée un compte gratuit sur [brevo.com](https://www.brevo.com).
2. Dans **Expéditeurs, domaines et IP dédiées > Expéditeurs**, ajoute ton adresse e-mail et valide-la (un e-mail de confirmation arrive).
3. Dans **SMTP et API > SMTP**, génère une **clé SMTP**. Note l'identifiant SMTP (une adresse du type `xxxx@smtp-brevo.com`) et la clé.
4. Retourne dans Supabase : **Authentication > Emails > SMTP Settings**, active **Enable custom SMTP** et remplis :
   - Sender email : ton adresse validée dans Brevo. Sender name : `Dispo ?`
   - Host : `smtp-relay.brevo.com`. Port : `587`
   - Username : l'identifiant SMTP de Brevo. Password : la clé SMTP.

### 3. Régler la connexion par code

Dans Supabase, menu **Authentication** :

1. **Sign In / Providers** : désactive **Allow new users to sign up** (l'app est fermée : seuls les invités entrent). Dans **Email**, vérifie que **Email OTP Length** vaut `6`.
2. **Emails > Templates > Magic Link** : remplace le sujet et le contenu par :
   - Sujet : `Ton code Dispo ? : {{ .Token }}`
   - Contenu :
     ```html
     <h2>Ton code pour entrer dans Dispo ?</h2>
     <p style="font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
     <p>Tape-le dans l'app. Il expire dans une heure.</p>
     ```
3. **Users > Add user > Create new user** : mets **ton** adresse e-mail, coche **Auto Confirm User**, laisse le mot de passe vide. Tu seras la première personne : l'app créera le groupe et te nommera admin.

### 4. Mettre le code sur GitHub

1. Crée un compte sur [github.com](https://github.com) si besoin, puis **New repository** : nom `dispo`, **Private**, sans README.
2. Dans un terminal ouvert dans ce dossier :
   ```bash
   git remote add origin https://github.com/TON-PSEUDO/dispo.git
   git push -u origin main
   ```

### 5. Déployer sur Vercel

1. Va sur [vercel.com](https://vercel.com), connecte-toi avec GitHub, **Add New > Project**, choisis le dépôt `dispo`.
2. Avant de cliquer **Deploy**, ouvre **Environment Variables** et ajoute les trois variables (les valeurs notées à l'étape 1) :

   | Nom | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | l'URL du projet |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | la Publishable key |
   | `SUPABASE_SECRET_KEY` | la Secret key |

3. **Deploy**. Au bout de deux minutes, tu obtiens une adresse du type `https://dispo-xxxx.vercel.app`.
4. Dans Supabase, **Authentication > URL Configuration** : mets cette adresse dans **Site URL**.

### 6. Premier lancement et invitations

1. Ouvre l'adresse Vercel sur ton téléphone, entre ton e-mail, tape le code reçu, remplis ton profil (prénom, couleur, ville ; le fuseau est détecté tout seul).
2. Touche ta pastille en haut à droite (**Réglages**), puis **Inviter quelqu'un** : ajoute l'adresse de Gaïa, d'Emma et du copain de Gaïa.
3. Envoie-leur l'adresse de l'app. Chacun entre son e-mail, reçoit son code, remplit son profil. Le copain choisit lui-même son prénom.
4. Pour l'installer : sur iPhone, dans Safari, bouton **Partager** puis **Sur l'écran d'accueil** ; sur Android, menu **⋮** de Chrome puis **Installer l'application**.

---

## Travailler sur le code

```bash
npm install
npm run dev     # l'app sur http://localhost:3000 (remplis d'abord .env.local à partir de .env.example)
npm test        # tests des fuseaux, des créneaux communs et des flammes
```

- `src/lib/` : la logique (fuseaux, créneaux communs, flammes, défis, compression des photos).
- `src/app/(app)/` : les écrans (Accueil, Dispos, Planning, Photos, Projets, Réglages).
- `supabase/migrations/` : la base de données et ses règles de sécurité.
- `PLAN.md` : le plan complet et ce qui reste à faire.
