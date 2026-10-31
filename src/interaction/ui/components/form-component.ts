import { expect, type Locator, type Response } from '@playwright/test';
import { ValidationError } from '@core/errors';
import { BaseComponent } from '../base-component';
import type { UiContext } from '../ui-context';

/** A form whose fields are addressed by their visible label, as a user would. */
export class FormComponent extends BaseComponent {
  public constructor(root: Locator, ui: UiContext, description = 'form') {
    super(root, ui, description);
  }

  public async fill(label: string, value: string): Promise<void> {
    await this.perform(`fill "${label}"`, () => this.field(label).fill(value));
  }

  public async select(label: string, option: string): Promise<void> {
    await this.perform(`select "${option}" in "${label}"`, async () => {
      await this.field(label).selectOption({ label: option });
    });
  }

  public async submit(buttonName: string): Promise<void> {
    await this.perform(`submit with "${buttonName}"`, () => this.button(buttonName).click());
  }

  /** Submits and resolves with the matching response; avoids racing the request. */
  public async submitAndWaitForResponse(
    buttonName: string,
    isExpectedResponse: (response: Response) => boolean,
  ): Promise<Response> {
    return this.perform(`submit with "${buttonName}" and await the response`, async () => {
      const [response] = await Promise.all([
        this.ui.page.waitForResponse(isExpectedResponse),
        this.button(buttonName).click(),
      ]);
      return response;
    });
  }

  public async isInvalid(label: string): Promise<boolean> {
    return (await this.field(label).getAttribute('aria-invalid')) === 'true';
  }

  /** Waits until the field is marked invalid (`aria-invalid="true"`). */
  public async waitUntilInvalid(label: string): Promise<void> {
    await this.perform(`mark "${label}" as invalid`, () =>
      expect(this.field(label)).toHaveAttribute('aria-invalid', 'true', {
        timeout: this.ui.expectTimeoutMs,
      }),
    );
  }

  /**
   * Returns the error message programmatically associated with an invalid field through
   * `aria-errormessage` (preferred) or `aria-describedby`. A visible error that is not associated
   * is an accessibility defect and fails with a ValidationError.
   */
  public async validationMessageFor(label: string): Promise<string> {
    await this.waitUntilInvalid(label);
    const field = this.field(label);
    const ids = [
      ...(await idReferences(field, 'aria-errormessage')),
      ...(await idReferences(field, 'aria-describedby')),
    ];
    for (const id of ids) {
      const message = this.ui.page.locator(`[id="${id}"]`);
      if (await message.isVisible()) {
        return (await message.innerText()).trim();
      }
    }
    throw new ValidationError(
      `Field "${label}" is invalid but no visible error message is associated with it.`,
      { context: { form: this.description, field: label, referencedIds: ids } },
    );
  }

  private field(label: string): Locator {
    return this.root.getByLabel(label, { exact: true });
  }

  private button(name: string): Locator {
    return this.root.getByRole('button', { name, exact: true });
  }
}

const SAFE_ID = /^[A-Za-z][\w:.-]*$/;

async function idReferences(field: Locator, attribute: string): Promise<string[]> {
  const value = await field.getAttribute(attribute);
  return (value ?? '').split(/\s+/).filter((id) => SAFE_ID.test(id));
}
