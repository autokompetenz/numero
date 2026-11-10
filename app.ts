// Point d'entrée Vercel (preset « express ») pour un déploiement mono-projet :
// le front Vite est servi depuis `public/` et l'API Express gère `/api/*`.
// En local, utiliser `npm run dev` (Vite) + `npm run dev` dans `server/`.
import 'express';
import app from './server/src/app.js';

export default app;
