import { authorize } from '../authorization';
import {
  boundedText,
  isRecord,
  rejectInvalid,
  unknownFields,
  validationProblem,
  type FieldError,
} from '../field-errors';
import { SPECIALTIES } from '../healthcare/appointment-policy';
import type { HealthcareStore, NewSlot, ProviderRecord } from '../healthcare/healthcare-store';
import type { IdentityProvider } from '../identity';
import { readJsonBody, sendEmpty, sendJson, type Route } from '../routing';

/**
 * Synthetic provider-directory, appointment and test-support APIs. Fixture rules only; the
 * policy values come from the store's ReferenceAppointmentPolicy.
 */
const SEARCH_LIMIT = { min: 1, max: 50, default: 20 } as const;
const TEXT_LENGTH = { min: 1, max: 120 } as const;
const SLOT_DURATION = { min: 5, max: 240 } as const;
const MAX_SEEDED_SLOTS = 50;

export function healthcareRoutes(identity: IdentityProvider, store: HealthcareStore): Route[] {
  return [
    {
      method: 'GET',
      path: '/api/providers',
      handle: (request, response, url) => {
        if (authorize(identity, request, response, 'providers:read') === undefined) {
          return;
        }
        const criteria = parseSearch(url.searchParams);
        const matching = store.searchProviders(criteria);
        sendJson(response, 200, {
          providers: matching.slice(0, criteria.limit).map(providerView),
          total: matching.length,
          limit: criteria.limit,
        });
      },
    },
    {
      method: 'GET',
      path: '/api/providers/:id',
      handle: (request, response, _url, params) => {
        if (authorize(identity, request, response, 'providers:read') === undefined) {
          return;
        }
        const provider = store.provider(params.id ?? '');
        if (provider === undefined) {
          sendJson(response, 404, { error: 'not_found' });
          return;
        }
        sendJson(response, 200, providerView(provider));
      },
    },
    {
      method: 'GET',
      path: '/api/providers/:id/slots',
      handle: (request, response, _url, params) => {
        if (authorize(identity, request, response, 'providers:read') === undefined) {
          return;
        }
        const provider = store.provider(params.id ?? '');
        if (provider === undefined) {
          sendJson(response, 404, { error: 'not_found' });
          return;
        }
        sendJson(response, 200, {
          providerId: provider.id,
          slots: store.upcomingSlots(provider.id),
        });
      },
    },
    {
      method: 'GET',
      path: '/api/appointments',
      handle: (request, response) => {
        const principal = authorize(identity, request, response, 'appointments:read');
        if (principal === undefined) {
          return;
        }
        const appointments = store
          .appointmentsOf(principal.subject)
          .map((appointment) => store.view(appointment, false));
        sendJson(response, 200, { appointments });
      },
    },
    {
      method: 'POST',
      path: '/api/appointments',
      handle: async (request, response) => {
        const principal = authorize(identity, request, response, 'appointments:write');
        if (principal === undefined) {
          return;
        }
        const { slotId, reasonForVisit } = parseBooking(
          await readJsonBody(request),
          store.policy.reasonForVisitMaxLength,
        );
        const appointment = store.book(principal.subject, slotId, reasonForVisit);
        sendJson(response, 201, store.view(appointment, true), {
          Location: `/api/appointments/${appointment.id}`,
        });
      },
    },
    {
      method: 'GET',
      path: '/api/appointments/:id',
      handle: (request, response, _url, params) => {
        const principal = authorize(identity, request, response, 'appointments:read');
        if (principal === undefined) {
          return;
        }
        // Another member's appointment answers 404, so its existence is not disclosed.
        const appointment = store.appointmentOf(principal.subject, params.id ?? '');
        if (appointment === undefined) {
          sendJson(response, 404, { error: 'not_found' });
          return;
        }
        sendJson(response, 200, store.view(appointment, true));
      },
    },
    {
      method: 'POST',
      path: '/api/appointments/:id/cancellation',
      handle: (request, response, _url, params) => {
        const principal = authorize(identity, request, response, 'appointments:write');
        if (principal === undefined) {
          return;
        }
        const appointment = store.cancel(principal.subject, params.id ?? '');
        sendJson(response, 200, store.view(appointment, false));
      },
    },
    {
      method: 'POST',
      path: '/api/test-support/providers',
      handle: async (request, response) => {
        const principal = authorize(identity, request, response, 'test-support:write');
        if (principal === undefined) {
          return;
        }
        const seed = parseProviderSeed(await readJsonBody(request));
        const created = store.addProvider(
          { ...seed.provider, seededBy: principal.subject },
          seed.slots,
        );
        sendJson(response, 201, { provider: providerView(created.provider), slots: created.slots });
      },
    },
    {
      method: 'DELETE',
      path: '/api/test-support/providers/:id',
      handle: (request, response, _url, params) => {
        const principal = authorize(identity, request, response, 'test-support:write');
        if (principal === undefined) {
          return;
        }
        if (!store.removeSeededProvider(params.id ?? '', principal.subject)) {
          sendJson(response, 404, { error: 'not_found' });
          return;
        }
        sendEmpty(response, 204);
      },
    },
  ];
}

function providerView(provider: ProviderRecord): Record<string, string> {
  return {
    id: provider.id,
    name: provider.name,
    specialty: provider.specialty,
    location: provider.location,
  };
}

function parseSearch(query: URLSearchParams): {
  name: string | undefined;
  specialty: string | undefined;
  limit: number;
} {
  const errors: FieldError[] = [];
  const rawName = query.get('name')?.trim() ?? '';
  const name = rawName === '' ? undefined : boundedText(rawName, TEXT_LENGTH.min, TEXT_LENGTH.max);
  if (rawName !== '' && name === undefined) {
    errors.push({ field: 'name', message: `must be at most ${TEXT_LENGTH.max} characters` });
  }
  const specialty = query.get('specialty') ?? '';
  if (specialty !== '' && !(SPECIALTIES as readonly string[]).includes(specialty)) {
    errors.push({ field: 'specialty', message: `must be one of ${SPECIALTIES.join(', ')}` });
  }
  const rawLimit = query.get('limit');
  const limit =
    rawLimit === null ? SEARCH_LIMIT.default : /^\d+$/.test(rawLimit) ? Number(rawLimit) : NaN;
  if (!(limit >= SEARCH_LIMIT.min && limit <= SEARCH_LIMIT.max)) {
    errors.push({
      field: 'limit',
      message: `must be an integer from ${SEARCH_LIMIT.min} to ${SEARCH_LIMIT.max}`,
    });
  }
  rejectInvalid(errors);
  return { name, specialty: specialty === '' ? undefined : specialty, limit };
}

function parseBooking(
  body: unknown,
  reasonMaxLength: number,
): { slotId: string; reasonForVisit: string } {
  if (!isRecord(body)) {
    throw validationProblem([{ field: '', message: 'must be a JSON object' }]);
  }
  const errors = unknownFields(body, ['slotId', 'reasonForVisit']);
  const slotId = typeof body.slotId === 'string' && body.slotId !== '' ? body.slotId : undefined;
  if (slotId === undefined) {
    errors.push({ field: 'slotId', message: 'is required' });
  }
  const reasonForVisit = boundedText(body.reasonForVisit, 1, reasonMaxLength);
  if (reasonForVisit === undefined) {
    errors.push({ field: 'reasonForVisit', message: `must be 1 to ${reasonMaxLength} characters` });
  }
  rejectInvalid(errors);
  return { slotId: slotId ?? '', reasonForVisit: reasonForVisit ?? '' };
}

function parseProviderSeed(body: unknown): {
  provider: { name: string; specialty: string; location: string };
  slots: NewSlot[];
} {
  if (!isRecord(body)) {
    throw validationProblem([{ field: '', message: 'must be a JSON object' }]);
  }
  const errors = unknownFields(body, ['name', 'specialty', 'location', 'slots']);
  const name = boundedText(body.name, TEXT_LENGTH.min, TEXT_LENGTH.max);
  const location = boundedText(body.location, TEXT_LENGTH.min, TEXT_LENGTH.max);
  for (const [field, value] of [
    ['name', name],
    ['location', location],
  ] as const) {
    if (value === undefined) {
      errors.push({
        field,
        message: `must be ${TEXT_LENGTH.min} to ${TEXT_LENGTH.max} characters`,
      });
    }
  }
  const specialty = typeof body.specialty === 'string' ? body.specialty : '';
  if (!(SPECIALTIES as readonly string[]).includes(specialty)) {
    errors.push({ field: 'specialty', message: `must be one of ${SPECIALTIES.join(', ')}` });
  }
  const slots = Array.isArray(body.slots) ? body.slots.map(parseSlot) : [];
  if (slots.length === 0 || slots.length > MAX_SEEDED_SLOTS || slots.includes(undefined)) {
    errors.push({
      field: 'slots',
      message: `must be 1 to ${MAX_SEEDED_SLOTS} slots, each with an ISO start and a duration of ${SLOT_DURATION.min}-${SLOT_DURATION.max} minutes`,
    });
  }
  rejectInvalid(errors);
  return {
    provider: { name: name ?? '', specialty, location: location ?? '' },
    slots: slots.filter((slot) => slot !== undefined),
  };
}

function parseSlot(value: unknown): NewSlot | undefined {
  if (
    !isRecord(value) ||
    typeof value.start !== 'string' ||
    Number.isNaN(Date.parse(value.start))
  ) {
    return undefined;
  }
  const { durationMinutes } = value;
  return typeof durationMinutes === 'number' &&
    Number.isInteger(durationMinutes) &&
    durationMinutes >= SLOT_DURATION.min &&
    durationMinutes <= SLOT_DURATION.max
    ? { start: value.start, durationMinutes }
    : undefined;
}
