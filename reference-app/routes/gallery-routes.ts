import { setTimeout as delay } from 'node:timers/promises';
import { sendJson, staticFile, type Route } from '../routing';

/** Synthetic catalog used by the component gallery. Not healthcare data. */
const CATALOG = [
  { name: 'Widget Alpha', category: 'Hardware', status: 'Available' },
  { name: 'Widget Beta', category: 'Hardware', status: 'Discontinued' },
  { name: 'Widget Cloud', category: 'Software', status: 'Available' },
  { name: 'Gadget Prime', category: 'Hardware', status: 'Available' },
  { name: 'Support Plan', category: 'Services', status: 'Available' },
] as const;

/** Fixture rule (not a business rule): keywords must be 2–40 characters after trimming. */
const KEYWORD_LENGTH = { min: 2, max: 40 } as const;

/** Simulated backend latency so tests must synchronize on the response, not on luck. */
const SEARCH_LATENCY_MS = 300;

const catalogSearch: Route = {
  method: 'GET',
  path: '/gallery/api/catalog',
  handle: async (_request, response, url) => {
    const keyword = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const category = url.searchParams.get('category') ?? '';
    if (keyword.length < KEYWORD_LENGTH.min || keyword.length > KEYWORD_LENGTH.max) {
      sendJson(response, 400, { error: 'invalid_keyword', ...KEYWORD_LENGTH });
      return;
    }
    await delay(SEARCH_LATENCY_MS);
    const items = CATALOG.filter(
      (item) =>
        item.name.toLowerCase().includes(keyword) &&
        (category === '' || item.category === category),
    );
    sendJson(response, 200, { items, total: items.length });
  },
};

export const galleryRoutes: readonly Route[] = [
  staticFile('/gallery', 'gallery/index.html'),
  staticFile('/gallery/about', 'gallery/about.html'),
  staticFile('/gallery/assets/gallery.js', 'gallery/gallery.js'),
  staticFile('/gallery/assets/gallery.css', 'gallery/gallery.css'),
  catalogSearch,
];
