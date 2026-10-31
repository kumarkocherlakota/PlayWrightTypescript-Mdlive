import type { ContractSchema } from '@interaction/api';
import { APPOINTMENT_STATUSES, type AppointmentStatus } from '../models/appointment';

/**
 * Response contracts of the synthetic appointments API. Mutable mirror types are needed because
 * Ajv's schema typing does not accept readonly members.
 */
interface ListedAppointmentContract {
  id: string;
  reference: string;
  providerId: string;
  providerName: string;
  specialty: string;
  location: string;
  start: string;
  durationMinutes: number;
  status: AppointmentStatus;
  bookedAt: string;
  cancelledAt?: string;
}

interface DetailedAppointmentContract extends ListedAppointmentContract {
  reasonForVisit: string;
}

const listedProperties = {
  id: { type: 'string', format: 'uuid' },
  reference: { type: 'string', minLength: 1 },
  providerId: { type: 'string', format: 'uuid' },
  providerName: { type: 'string', minLength: 1 },
  specialty: { type: 'string', minLength: 1 },
  location: { type: 'string', minLength: 1 },
  start: { type: 'string', format: 'date-time' },
  durationMinutes: { type: 'integer', minimum: 1 },
  status: { type: 'string', enum: [...APPOINTMENT_STATUSES] },
  bookedAt: { type: 'string', format: 'date-time' },
  cancelledAt: { type: 'string', format: 'date-time', nullable: true },
} as const;

const REQUIRED = [
  'id',
  'reference',
  'providerId',
  'providerName',
  'specialty',
  'location',
  'start',
  'durationMinutes',
  'status',
  'bookedAt',
] as const;

/** Detail view: includes the reason for visit. */
export const appointmentSchema: ContractSchema<DetailedAppointmentContract> = {
  type: 'object',
  properties: {
    ...listedProperties,
    reasonForVisit: { type: 'string', minLength: 1 },
  },
  required: [...REQUIRED, 'reasonForVisit'],
  additionalProperties: false,
};

/**
 * List view and cancellation response. `additionalProperties: false` makes the contract fail if
 * the reason for visit (or anything else) is added to these views.
 */
export const listedAppointmentSchema: ContractSchema<ListedAppointmentContract> = {
  type: 'object',
  properties: listedProperties,
  required: [...REQUIRED],
  additionalProperties: false,
};

export const appointmentListSchema: ContractSchema<{
  appointments: ListedAppointmentContract[];
}> = {
  type: 'object',
  properties: { appointments: { type: 'array', items: listedAppointmentSchema } },
  required: ['appointments'],
  additionalProperties: false,
};
