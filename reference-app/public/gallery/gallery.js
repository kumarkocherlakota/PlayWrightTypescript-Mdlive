// Browser script for the synthetic component gallery. Plain JS: served as-is, no build step.
'use strict';

const KEYWORD_MIN = 2;
const KEYWORD_MAX = 40;

const form = document.querySelector('form');
const keyword = document.getElementById('keyword');
const keywordError = document.getElementById('keyword-error');
const category = document.getElementById('category');
const statusRegion = document.getElementById('search-status');
const table = document.querySelector('table');
const tableBody = table.querySelector('tbody');
const dialog = document.querySelector('dialog');
let lastTrigger = null;

function validateKeyword(value) {
  if (value === '') {
    return 'Enter a keyword to search';
  }
  if (value.length < KEYWORD_MIN || value.length > KEYWORD_MAX) {
    return `Keyword must be ${KEYWORD_MIN} to ${KEYWORD_MAX} characters`;
  }
  return null;
}

function showError(message) {
  keywordError.textContent = message;
  keywordError.hidden = false;
  keyword.setAttribute('aria-invalid', 'true');
  keyword.setAttribute('aria-errormessage', 'keyword-error');
  keyword.focus();
}

function clearError() {
  keywordError.textContent = '';
  keywordError.hidden = true;
  keyword.removeAttribute('aria-invalid');
  keyword.removeAttribute('aria-errormessage');
}

function cell(text) {
  const td = document.createElement('td');
  td.textContent = text;
  return td;
}

function renderResults(items) {
  tableBody.replaceChildren(
    ...items.map((item) => {
      const row = document.createElement('tr');
      const actions = document.createElement('td');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'View details';
      button.setAttribute('aria-label', `View details for ${item.name}`);
      button.addEventListener('click', () => openDetails(item, button));
      actions.append(button);
      row.append(cell(item.name), cell(item.category), cell(item.status), actions);
      return row;
    }),
  );
  table.hidden = items.length === 0;
  statusRegion.textContent =
    items.length === 0
      ? 'No results found'
      : `${items.length} ${items.length === 1 ? 'result' : 'results'} found`;
}

function openDetails(item, trigger) {
  lastTrigger = trigger;
  document.getElementById('details-title').textContent = item.name;
  document.getElementById('details-category').textContent = item.category;
  document.getElementById('details-status').textContent = item.status;
  dialog.showModal();
  document.getElementById('details-close').focus();
}

dialog.addEventListener('close', () => {
  lastTrigger?.focus();
});

document.getElementById('details-close').addEventListener('click', () => dialog.close());

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const value = keyword.value.trim();
  const error = validateKeyword(value);
  if (error !== null) {
    showError(error);
    return;
  }
  clearError();
  statusRegion.textContent = 'Searching…';
  const query = new URLSearchParams({ q: value, category: category.value });
  try {
    const response = await fetch(`/gallery/api/catalog?${query.toString()}`);
    if (!response.ok) {
      statusRegion.textContent = 'Search failed. Try again.';
      return;
    }
    const body = await response.json();
    renderResults(body.items);
  } catch {
    statusRegion.textContent = 'Search failed. Try again.';
  }
});
