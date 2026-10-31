// Synthetic patient portal: books the time chosen on the provider search page.
import { callApi, timeElement } from './portal-api.js';

const params = new URLSearchParams(window.location.search);
const providerId = params.get('provider') ?? '';
const slotId = params.get('slot') ?? '';

const form = document.querySelector('form[aria-label="Book appointment"]');
const reason = document.getElementById('reason');
const reasonError = document.getElementById('reason-error');
const bookingError = document.getElementById('booking-error');
const status = document.getElementById('booking-status');

const OUTCOME_MESSAGES = {
  slot_unavailable: () => 'This time is no longer available. Choose another time.',
  slot_in_past: () => 'This time has already passed. Choose another time.',
  slot_not_found: () => 'This time could not be found. Choose another time.',
  beyond_booking_horizon: (body) =>
    `Appointments can be booked up to ${body.bookingHorizonDays} days ahead. Choose an earlier time.`,
};

async function showSummary() {
  const [provider, slots] = await Promise.all([
    callApi(`/providers/${encodeURIComponent(providerId)}`),
    callApi(`/providers/${encodeURIComponent(providerId)}/slots`),
  ]);
  const slot = (slots.body.slots ?? []).find((each) => each.id === slotId);
  if (provider.status !== 200 || slot === undefined) {
    showError('This time could not be found. Choose another time.');
    return;
  }
  document.getElementById('summary-provider').textContent = provider.body.name;
  document.getElementById('summary-specialty').textContent = provider.body.specialty;
  document.getElementById('summary-location').textContent = provider.body.location;
  document.getElementById('summary-time').replaceChildren(timeElement(slot.start));
  document.getElementById('booking-summary').hidden = false;
  form.hidden = false;
}

function showError(message) {
  bookingError.textContent = message;
  bookingError.hidden = false;
}

function setReasonError(message) {
  reason.setAttribute('aria-invalid', message === undefined ? 'false' : 'true');
  reasonError.textContent = message ?? '';
  reasonError.hidden = message === undefined;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  bookingError.hidden = true;
  setReasonError(undefined);
  status.textContent = 'Booking…';

  const result = await callApi('/appointments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slotId, reasonForVisit: reason.value }),
  });
  status.textContent = '';
  if (result.status === 201) {
    form.hidden = true;
    document.getElementById('confirmation-reference').textContent = result.body.reference;
    document.getElementById('confirmation-time').replaceChildren(timeElement(result.body.start));
    document.getElementById('booking-confirmation').hidden = false;
    status.textContent = `Appointment ${result.body.reference} is booked.`;
    return;
  }
  const reasonDetail = (result.body.details ?? []).find((each) => each.field === 'reasonForVisit');
  if (reasonDetail !== undefined) {
    setReasonError(`Reason for visit ${reasonDetail.message}.`);
    return;
  }
  const describe = OUTCOME_MESSAGES[result.body.error];
  showError(
    describe === undefined ? 'The appointment could not be booked.' : describe(result.body),
  );
});

void showSummary();
