/**
 * Supabase Integration - Main Export
 *
 * Exports the Supabase client and database operations
 */

import SupabaseClient from './client.js';
import * as dbOps from './operations.js';

// Initialize default client
const supabaseClient = new SupabaseClient();

/**
 * Get Supabase client instance
 *
 * @param {Object} config Optional configuration override
 * @returns {SupabaseClient} Supabase client instance
 */
export function getClient(config) {
  return config ? new SupabaseClient(config) : supabaseClient;
}

/**
 * Get database operations helper
 *
 * @param {SupabaseClient} client Optional custom client instance
 * @returns {Object} Database operations
 */
export function db(client = supabaseClient) {
  return {
    select: (table, opts) => dbOps.select(client.getClient(), table, opts),
    insert: (table, data) => dbOps.insert(client.getClient(), table, data),
    update: (table, id, data) => dbOps.update(client.getClient(), table, id, data),
    delete: (table, id) => dbOps.delete(client.getClient(), table, id),
    getById: (table, id) => dbOps.getById(client.getClient(), table, id),
    count: (table, filters) => dbOps.count(client.getClient(), table, filters),
    batchInsert: (table, records) => dbOps.batchInsert(client.getClient(), table, records),
  };
}

/**
 * Export client class for instantiation
 */
export { SupabaseClient };

/**
 * Export operations directly
 */
export * as operations from './operations.js';

export default {
  getClient,
  db,
  SupabaseClient,
  operations: dbOps,
};
