// Synthetic patient portal: provider search. Each result card lists the provider's open times as
// links to the booking page.
import { callApi, timeElement } from './portal-api.js';

const form = document.querySelector('form[aria-label="Provider search"]');
const status = document.getElementById('search-status');
const error = document.getElementById('search-error');
const results = document.getElementById('provider-results');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  error.hidden = true;
  status.textContent = 'Searching…';
  results.replaceChildren();

  const query = new URLSearchParams();
  const name = form.elements.name.value.trim();
  const specialty = form.elements.specialty.value;
  if (name !== '') query.set('name', name);
  if (specialty !== '') query.set('specialty', specialty);

  const search = await callApi(`/providers?${query}`);
  if (search.status !== 200) {
    status.textContent = '';
    error.textContent = 'Provider search is unavailable. Try again later.';
    error.hidden = false;
    return;
  }
  const providers = search.body.providers;
  const cards = await Promise.all(providers.map(renderCard));
  results.replaceChildren(...cards);
  status.textContent =
    providers.length === 0
      ? 'No providers match your search.'
      : `${providers.length} ${providers.length === 1 ? 'provider' : 'providers'} found`;
});

async function renderCard(provider) {
  const item = document.createElement('li');
  const article = document.createElement('article');
  article.className = 'provider-card';
  const headingId = `provider-${provider.id}`;
  article.setAttribute('aria-labelledby', headingId);

  const heading = document.createElement('h2');
  heading.id = headingId;
  heading.textContent = provider.name;
  const specialty = document.createElement('p');
  specialty.textContent = provider.specialty;
  const location = document.createElement('p');
  location.textContent = provider.location;

  const slotsHeading = document.createElement('h3');
  slotsHeading.textContent = 'Available times';
  const slots = document.createElement('ul');
  slots.className = 'slots';
  slots.setAttribute('aria-label', `Available times for ${provider.name}`);

  const { body } = await callApi(`/providers/${encodeURIComponent(provider.id)}/slots`);
  const open = (body.slots ?? []).filter((slot) => slot.available);
  for (const slot of open) {
    const link = document.createElement('a');
    const target = new URLSearchParams({ provider: provider.id, slot: slot.id });
    link.href = `/portal/book?${target}`;
    link.append(timeElement(slot.start));
    const entry = document.createElement('li');
    entry.append(link);
    slots.append(entry);
  }
  if (open.length === 0) {
    const none = document.createElement('p');
    none.textContent = 'No available times.';
    article.append(heading, specialty, location, slotsHeading, none);
  } else {
    article.append(heading, specialty, location, slotsHeading, slots);
  }
  item.append(article);
  return item;
}
