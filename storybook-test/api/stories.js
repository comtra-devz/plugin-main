/**
 * Vercel serverless: GET /api/stories per Comtra Sync.
 * Stesso payload di server.mjs (uso locale). Su Vercel server.mjs non gira.
 */
const STORIES_JSON = {
  stories: [
    { component: 'Button', title: 'Components/Button', id: 'components-button--primary' },
    { component: 'Button', title: 'Components/Button', id: 'components-button--secondary' },
    { component: 'Input', title: 'Components/Input', id: 'components-input--default' },
    { component: 'Input', title: 'Components/Input', id: 'components-input--with-value' },
    { component: 'Card', title: 'Components/Card', id: 'components-card--default' },
  ],
};

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(STORIES_JSON);
}
