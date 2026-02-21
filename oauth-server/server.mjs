/**
 * Avvio del server OAuth (per uso locale o host che eseguono Node).
 * Su Vercel non si usa: la function in api/figma-oauth.mjs importa app da ./app.mjs.
 */
import app from './app.mjs';

const PORT = process.env.PORT || 3456;
const BASE_URL = (process.env.BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Comtra OAuth server: ${BASE_URL}`);
    if (!process.env.FIGMA_CLIENT_ID || !process.env.FIGMA_CLIENT_SECRET) {
      console.warn('Set FIGMA_CLIENT_ID and FIGMA_CLIENT_SECRET.');
    }
  });
}
