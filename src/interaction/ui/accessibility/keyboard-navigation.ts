import { LocatorError } from '@core/errors';
import type { UiContext } from '../ui-context';

/** The element that has keyboard focus after one Tab press. */
export interface FocusStop {
  /** ARIA role and accessible name, as Playwright's accessibility snapshot reports them. */
  readonly role: string;
  readonly name: string;
  /** Whether the element draws a focus indicator (an outline or a box shadow). */
  readonly indicatorVisible: boolean;
}

const SNAPSHOT_LINE = /^- ([\w-]+)(?: "((?:[^"\\]|\\.)*)")?/;

/**
 * The key that moves focus to the next control. WebKit on macOS follows the system default where
 * Tab skips buttons and links unless "Keyboard navigation" is enabled; Option+Tab reaches every
 * control, as it does for macOS users without that setting.
 */
export function focusNextKey(browserName: string | undefined, platform: string): string {
  return browserName === 'webkit' && platform === 'darwin' ? 'Alt+Tab' : 'Tab';
}

/**
 * Moves keyboard focus with the Tab key and reports where it lands. Accessible names come from
 * Playwright's accessibility snapshot, not from the DOM, so they match what assistive technology
 * is given. The focus-indicator check is a heuristic: it detects an outline or box shadow, not
 * whether the indicator has enough contrast (WCAG 2.4.11, 2.4.13 need manual review).
 */
export class KeyboardNavigation {
  public constructor(private readonly ui: UiContext) {}

  /** Presses Tab `count` times from the current focus and records each stop. */
  public async tabThrough(count: number): Promise<FocusStop[]> {
    const key = focusNextKey(
      this.ui.page.context().browser()?.browserType().name(),
      process.platform,
    );
    const stops: FocusStop[] = [];
    for (let press = 1; press <= count; press += 1) {
      await this.ui.page.keyboard.press(key);
      stops.push(await this.focusedElement(key, press));
    }
    this.ui.logger.debug('Keyboard focus order recorded', {
      stops: stops.map((stop) => `${stop.role} "${stop.name}"`),
    });
    return stops;
  }

  private async focusedElement(key: string, press: number): Promise<FocusStop> {
    const focused = this.ui.page.locator(':focus');
    if ((await focused.count()) !== 1) {
      throw new LocatorError(
        `Keyboard focus is not on a single element after pressing ${key} ${String(press)} time(s).`,
        { context: { url: this.ui.page.url(), key, press } },
      );
    }
    const snapshot = await focused.ariaSnapshot();
    const match = SNAPSHOT_LINE.exec(snapshot.split('\n')[0] ?? '');
    const indicatorVisible = await focused.evaluate((element) => {
      const style = getComputedStyle(element);
      const outline = style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0;
      return outline || style.boxShadow !== 'none';
    });
    return {
      role: match?.[1] ?? 'unknown',
      name: (match?.[2] ?? '').replace(/\\(.)/g, '$1'),
      indicatorVisible,
    };
  }
}
