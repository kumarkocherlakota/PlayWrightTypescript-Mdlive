import type { ContractSchema } from '@interaction/api';
import { SPECIALTIES, type Specialty } from '../models/provider';

/**
 * Response contracts of the synthetic provider-directory and test-support APIs. Mutable mirror
 * types are needed because Ajv's schema typing does not accept readonly members.
 */
interface ProviderContract {
  id: string;
  name: string;
  specialty: Specialty;
  location: string;
}

interface SlotContract {
  id: string;
  providerId: string;
  start: string;
  durationMinutes: number;
}

interface SlotAvailabilityContract extends SlotContract {
  available: boolean;
}

export const providerSchema: ContractSchema<ProviderContract> = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', minLength: 1 },
    specialty: { type: 'string', enum: [...SPECIALTIES] },
    location: { type: 'string', minLength: 1 },
  },
  required: ['id', 'name', 'specialty', 'location'],
  additionalProperties: false,
};

const slotProperties = {
  id: { type: 'string', format: 'uuid' },
  providerId: { type: 'string', format: 'uuid' },
  start: { type: 'string', format: 'date-time' },
  durationMinutes: { type: 'integer', minimum: 1 },
} as const;

const slotSchema: ContractSchema<SlotContract> = {
  type: 'object',
  properties: slotProperties,
  required: ['id', 'providerId', 'start', 'durationMinutes'],
  additionalProperties: false,
};

export const providerSearchSchema: ContractSchema<{
  providers: ProviderContract[];
  total: number;
  limit: number;
}> = {
  type: 'object',
  properties: {
    providers: { type: 'array', items: providerSchema },
    total: { type: 'integer', minimum: 0 },
    limit: { type: 'integer', minimum: 1 },
  },
  required: ['providers', 'total', 'limit'],
  additionalProperties: false,
};

export const providerSlotsSchema: ContractSchema<{
  providerId: string;
  slots: SlotAvailabilityContract[];
}> = {
  type: 'object',
  properties: {
    providerId: { type: 'string', format: 'uuid' },
    slots: {
      type: 'array',
      items: {
        type: 'object',
        properties: { ...slotProperties, available: { type: 'boolean' } },
        required: ['id', 'providerId', 'start', 'durationMinutes', 'available'],
        additionalProperties: false,
      },
    },
  },
  required: ['providerId', 'slots'],
  additionalProperties: false,
};

export const seededProviderSchema: ContractSchema<{
  provider: ProviderContract;
  slots: SlotContract[];
}> = {
  type: 'object',
  properties: {
    provider: providerSchema,
    slots: { type: 'array', items: slotSchema },
  },
  required: ['provider', 'slots'],
  additionalProperties: false,
};
