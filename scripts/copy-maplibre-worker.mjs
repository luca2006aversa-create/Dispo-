// Copie le « worker » de MapLibre (le fichier qui charge les tuiles de la carte) dans public/,
// car Next.js ne le sert pas tout seul. Lancé avant `dev` et `build`.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('public', { recursive: true });
copyFileSync('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'public/maplibre-gl-worker.mjs');
