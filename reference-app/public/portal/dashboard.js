// Synthetic patient portal: the member's appointments with cancellation.
import { callApi, cell, timeElement } from './portal-api.js';

const table = document.querySelector('table[aria-label="My appointments"]');
const body = table.querySelector('tbody');
const empty = document.getElementById('no-appointments');
const status = document.getElementById('dashboard-status');
const error = document.getElementById('dashboard-error');
const dialog = document.querySelector('dialog');
const description = document.getElementById('cancel-description');
let pending;
let opener;

const STATUS_LABELS = { booked: 'Booked', cancelled: 'Cancelled' };

async function load() {
  const result = await callApi('/appointments');
  if (result.status !== 200) {
    showError('Your appointments could not be loaded. Try again later.');
    return;
  }
  const appointments = result.body.appointments;
  body.replaceChildren(...appointments.map(renderRow));
  table.hidden = appointments.length === 0;
  empty.hidden = appointments.length !== 0;
}

function renderRow(appointment) {
  const row = document.createElement('tr');
  const actions = document.createElement('td');
  if (appointment.status === 'booked') {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Cancel appointment';
    button.addEventListener('click', () => askToCancel(appointment, button));
    actions.append(button);
  }
  row.append(
    cell(appointment.reference),
    cell(appointment.providerName),
    cell(appointment.specialty),
    cell(timeElement(appointment.start)),
    cell(STATUS_LABELS[appointment.status] ?? appointment.status),
    actions,
  );
  return row;
}

function askToCancel(appointment, button) {
  pending = appointment;
  opener = button;
  description.replaceChildren(
    `${appointment.reference} with ${appointment.providerName} on `,
    timeElement(appointment.start),
  );
  dialog.showModal();
}

function showError(message) {
  error.textContent = message;
  error.hidden = false;
}

document.getElementById('cancel-keep').addEventListener('click', () => dialog.close());

dialog.addEventListener('close', () => {
  opener?.focus();
});

document.getElementById('cancel-confirm').addEventListener('click', async () => {
  const appointment = pending;
  dialog.close();
  error.hidden = true;
  status.textContent = '';
  const result = await callApi(`/appointments/${encodeURIComponent(appointment.id)}/cancellation`, {
    method: 'POST',
  });
  if (result.status === 200) {
    await load();
    status.textContent = `Appointment ${appointment.reference} is cancelled.`;
    return;
  }
  if (result.body.error === 'cancellation_window_closed') {
    showError(
      `Appointments starting within ${result.body.cancellationCutoffHours} hours cannot be cancelled online.`,
    );
    return;
  }
  showError('The appointment could not be cancelled.');
});

void load();
