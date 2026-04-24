/**
 * Supabase Database Operations
 *
 * Provides common CRUD operations and helpers
 * Abstracts table operations and queries
 */

/**
 * Generic SELECT operation
 *
 * @param {Object} client Supabase client instance
 * @param {string} tableName Table name
 * @param {Object} options Query options (filters, sorting, etc)
 * @returns {Promise<Array>} Query results
 */
export async function select(client, tableName, options = {}) {
  const {
    columns = '*',
    filters = {},
    orderBy = null,
    ascending = true,
    limit = null,
    offset = 0,
  } = options;

  try {
    let query = client.from(tableName).select(columns);

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        query = query.eq(key, value);
      }
    });

    // Apply ordering
    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }

    // Apply limit and offset
    if (limit) {
      query = query.range(offset, offset + limit - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Select failed: ${error.message}`);
    }

    return data || [];
  } catch (error) {
    console.error(`[Supabase] Select error on ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Generic INSERT operation
 *
 * @param {Object} client Supabase client instance
 * @param {string} tableName Table name
 * @param {Object} data Record data to insert
 * @returns {Promise<Object>} Inserted record
 */
export async function insert(client, tableName, data) {
  try {
    const { data: inserted, error } = await client.from(tableName).insert([data]).select();

    if (error) {
      throw new Error(`Insert failed: ${error.message}`);
    }

    return inserted?.[0] || data;
  } catch (error) {
    console.error(`[Supabase] Insert error on ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Generic UPDATE operation
 *
 * @param {Object} client Supabase client instance
 * @param {string} tableName Table name
 * @param {string} id Record ID
 * @param {Object} data Partial record data to update
 * @returns {Promise<Object>} Updated record
 */
export async function update(client, tableName, id, data) {
  try {
    const { data: updated, error } = await client
      .from(tableName)
      .update(data)
      .eq('id', id)
      .select();

    if (error) {
      throw new Error(`Update failed: ${error.message}`);
    }

    return updated?.[0] || data;
  } catch (error) {
    console.error(`[Supabase] Update error on ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Generic DELETE operation
 *
 * @param {Object} client Supabase client instance
 * @param {string} tableName Table name
 * @param {string} id Record ID
 * @returns {Promise<boolean>} True if deletion successful
 */
export async function delete_(client, tableName, id) {
  try {
    const { error } = await client.from(tableName).delete().eq('id', id);

    if (error) {
      throw new Error(`Delete failed: ${error.message}`);
    }

    return true;
  } catch (error) {
    console.error(`[Supabase] Delete error on ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Get single record by ID
 *
 * @param {Object} client Supabase client instance
 * @param {string} tableName Table name
 * @param {string} id Record ID
 * @returns {Promise<Object>} Single record or null
 */
export async function getById(client, tableName, id) {
  try {
    const { data, error } = await client.from(tableName).select().eq('id', id).single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "not found" - this is expected when record doesn't exist
      throw new Error(`Get failed: ${error.message}`);
    }

    return data || null;
  } catch (error) {
    console.error(`[Supabase] GetById error on ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Count records in table
 *
 * @param {Object} client Supabase client instance
 * @param {string} tableName Table name
 * @param {Object} filters Optional filters
 * @returns {Promise<number>} Record count
 */
export async function count(client, tableName, filters = {}) {
  try {
    let query = client.from(tableName).select('*', { count: 'exact', head: true });

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        query = query.eq(key, value);
      }
    });

    const { count: total, error } = await query;

    if (error) {
      throw new Error(`Count failed: ${error.message}`);
    }

    return total || 0;
  } catch (error) {
    console.error(`[Supabase] Count error on ${tableName}:`, error.message);
    throw error;
  }
}

/**
 * Batch insert multiple records
 *
 * @param {Object} client Supabase client instance
 * @param {string} tableName Table name
 * @param {Array} records Array of records to insert
 * @returns {Promise<Array>} Inserted records
 */
export async function batchInsert(client, tableName, records) {
  try {
    const { data: inserted, error } = await client.from(tableName).insert(records).select();

    if (error) {
      throw new Error(`Batch insert failed: ${error.message}`);
    }

    return inserted || [];
  } catch (error) {
    console.error(`[Supabase] Batch insert error on ${tableName}:`, error.message);
    throw error;
  }
}

export default {
  select,
  insert,
  update,
  delete: delete_,
  getById,
  count,
  batchInsert,
};
