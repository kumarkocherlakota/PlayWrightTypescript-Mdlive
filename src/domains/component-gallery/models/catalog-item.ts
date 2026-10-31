import { ValidationError } from '@core/errors';

export interface CatalogItem {
  readonly name: string;
  readonly category: string;
  readonly status: string;
}

export interface SearchCriteria {
  readonly keyword: string;
  /** Visible option label; omitted means "All categories". */
  readonly category?: string;
}

export type SearchAttempt =
  | { readonly accepted: true; readonly announcement: string }
  | { readonly accepted: false; readonly validationMessage: string };

export interface SearchResults {
  readonly items: readonly CatalogItem[];
  readonly announcement: string;
}

export interface DialogState {
  readonly title: string;
  readonly hasFocus: boolean;
}

export interface GalleryPageState {
  readonly heading: string;
  readonly currentNavigationItem: string | undefined;
}

/** Maps a header-keyed record (UI table row or Gherkin DataTable row) to a CatalogItem. */
export function catalogItemFromRecord(record: Readonly<Record<string, string>>): CatalogItem {
  return {
    name: requiredColumn(record, 'Name'),
    category: requiredColumn(record, 'Category'),
    status: requiredColumn(record, 'Status'),
  };
}

function requiredColumn(record: Readonly<Record<string, string>>, column: string): string {
  const value = record[column];
  if (value === undefined) {
    throw new ValidationError(`Catalog record is missing the "${column}" column.`, {
      context: { column, available: Object.keys(record) },
    });
  }
  return value;
}
