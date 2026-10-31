import { defineParameterType } from '@cucumber/cucumber';
import { FrameworkError } from '@core/errors';
import { SENSITIVE_VALUE_TYPES, type SensitiveValueType } from '@core/test-data';

export const DIALOG_CLOSE_METHODS = ['Close button', 'Escape key'] as const;
export type DialogCloseMethod = (typeof DIALOG_CLOSE_METHODS)[number];

defineParameterType({
  name: 'dialogCloseMethod',
  regexp: new RegExp(DIALOG_CLOSE_METHODS.join('|')),
  transformer: (text: string): DialogCloseMethod => {
    const match = DIALOG_CLOSE_METHODS.find((method) => method === text);
    if (match === undefined) {
      throw new FrameworkError(`Unsupported dialog close method "${text}".`);
    }
    return match;
  },
});

defineParameterType({
  name: 'sensitiveValueType',
  regexp: new RegExp(SENSITIVE_VALUE_TYPES.join('|')),
  transformer: (text: string): SensitiveValueType => {
    const match = SENSITIVE_VALUE_TYPES.find((type) => type === text);
    if (match === undefined) {
      throw new FrameworkError(`Unsupported sensitive value type "${text}".`);
    }
    return match;
  },
});
