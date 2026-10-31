import type { ApiResponse, ContractSchema, SchemaValidator } from '@interaction/api';
import type { RequestRejection } from '../models/request-outcome';

interface ErrorContract {
  error: string;
  details?: { field: string; message: string }[];
}

/** Error body shared by the healthcare APIs: an error code plus optional field details. */
export const apiErrorSchema: ContractSchema<ErrorContract> = {
  type: 'object',
  properties: {
    error: { type: 'string', minLength: 1 },
    details: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        properties: { field: { type: 'string' }, message: { type: 'string' } },
        required: ['field', 'message'],
        additionalProperties: false,
      },
    },
  },
  required: ['error'],
  additionalProperties: true,
};

/** Validates an error response against the shared contract and returns it as a rejection. */
export function rejectionFrom(response: ApiResponse, validator: SchemaValidator): RequestRejection {
  const body = validator.validate(apiErrorSchema, response.body, 'API error');
  return {
    accepted: false,
    status: response.status,
    error: body.error,
    invalidFields: (body.details ?? []).map((detail) => detail.field),
  };
}
