/**
 * Supabase Client Wrapper
 *
 * Provides a wrapper around the Supabase SDK
 * Handles authentication and connection management
 */

import { createClient } from '@supabase/supabase-js';

class SupabaseClient {
  /**
   * Initialize Supabase client with credentials from environment
   *
   * @param {Object} config Configuration object
   * @param {string} config.url Supabase project URL
   * @param {string} config.key Supabase anonymous/public key
   * @param {Object} config.options Additional Supabase client options
   */
  constructor(config = {}) {
    const supabaseUrl = config.url || process.env.VITE_SUPABASE_URL;
    const supabaseKey = config.key || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn('Supabase: Missing URL or API key in configuration');
    }

    this.client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: false,
      },
      ...config.options,
    });

    this.url = supabaseUrl;
    this.key = supabaseKey;
  }

  /**
   * Get the underlying Supabase client
   *
   * @returns {Object} Supabase client instance
   */
  getClient() {
    return this.client;
  }

  /**
   * Get reference to a table
   *
   * @param {string} tableName Table name
   * @returns {Object} Supabase table reference
   */
  table(tableName) {
    return this.client.from(tableName);
  }

  /**
   * Test connection to Supabase
   *
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      const { data, error } = await this.client.from('information_schema.tables').select('table_name').limit(1);

      if (error) {
        console.error('Supabase connection test failed:', error.message);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Supabase connection test error:', error.message);
      return false;
    }
  }

  /**
   * Authenticate with email and password
   *
   * @param {string} email User email
   * @param {string} password User password
   * @returns {Promise<Object>} Auth response
   */
  async signIn(email, password) {
    return this.client.auth.signInWithPassword({
      email,
      password,
    });
  }

  /**
   * Sign out user
   *
   * @returns {Promise<Object>} Sign out response
   */
  async signOut() {
    return this.client.auth.signOut();
  }

  /**
   * Get current user
   *
   * @returns {Promise<Object>} Current user or null
   */
  async getCurrentUser() {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    return user;
  }

  /**
   * Run RPC function
   *
   * @param {string} functionName Function name
   * @param {Object} params Function parameters
   * @returns {Promise<Object>} RPC response
   */
  async rpc(functionName, params = {}) {
    return this.client.rpc(functionName, params);
  }
}

export default SupabaseClient;
