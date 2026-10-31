/**
 * Public contract of the inventory domain: the framework's API self-test target and the
 * reference template for API domains (models → schemas → builders → api → validators →
 * workflows → index.ts). Only symbols exported here may be used by steps or other domains
 * (RULE-018).
 */
export {
  ACCESS_METHODS,
  INVENTORY_CATEGORIES,
  type AccessAttempt,
  type AccessMethod,
  type InventoryCategory,
  type InventoryItem,
  type InventoryList,
  type ListCriteria,
  type NewInventoryItem,
  type RequestOutcome,
} from './models/inventory-item';
export { InventoryWorkflow } from './workflows/inventory-workflow';
