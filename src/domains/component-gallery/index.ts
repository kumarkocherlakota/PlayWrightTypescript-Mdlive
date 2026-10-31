/**
 * Public contract of the component-gallery domain: the framework's UI self-test target and the
 * reference template for new domains (models → pages → workflows → index.ts).
 * Only symbols exported here may be used by steps or other domains (RULE-018).
 */
export {
  catalogItemFromRecord,
  type CatalogItem,
  type DialogState,
  type GalleryPageState,
  type SearchAttempt,
  type SearchCriteria,
  type SearchResults,
} from './models/catalog-item';
export {
  ComponentGalleryWorkflow,
  type GallerySection,
} from './workflows/component-gallery-workflow';
