/**
 * Bubble API Client Wrapper
 *
 * Provides a wrapper around the Bubble.io REST API
 * Handles authentication and API calls
 */

class BubbleClient {
  /**
   * Initialize Bubble client with credentials from environment
   *
   * @param {Object} config Configuration object
   * @param {string} config.apiUrl Bubble app API URL
   * @param {string} config.apiKey Bubble API token
   * @param {string} config.appVersion App version (dev or live)
   */
  constructor(config = {}) {
    this.apiUrl = config.apiUrl || process.env.BUBBLE_API_URL;
    this.apiKey = config.apiKey || process.env.BUBBLE_API_KEY;
    this.appVersion = config.appVersion || process.env.BUBBLE_APP_VERSION || 'live';

    if (!this.apiUrl || !this.apiKey) {
      console.warn('Bubble: Missing API URL or API key in configuration');
    }
  }

  /**
   * Make authenticated request to Bubble API
   *
   * @param {string} endpoint API endpoint path
   * @param {Object} options Fetch options (method, body, headers, etc)
   * @returns {Promise<Object>} API response
   */
  async request(endpoint, options = {}) {
    const url = `${this.apiUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        throw new Error(`Bubble API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`[Bubble] Request error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get data from a database thing
   *
   * @param {string} dataType Data type name
   * @param {Object} options Query options (filters, constraints, etc)
   * @returns {Promise<Array>} Data records
   */
  /**
   * Get data from a database thing
   *
   * @param {string} dataType Data type name
   * @param {Object} options Query options (filters, constraints, etc)
   * @returns {Promise<Array>} Data records
   */
  async getThings(dataType, options = {}) {
    const queryParams = new URLSearchParams();
    const constraints = options.constraints || [];

    if (options.tenantId) {
      constraints.push({
        key: 'tenant_id',
        constraint_type: 'equals',
        value: options.tenantId,
      });
    }

    if (constraints.length > 0) {
      queryParams.append('constraints', JSON.stringify(constraints));
    }

    if (options.sorting) {
      queryParams.append('sorting', JSON.stringify(options.sorting));
    }

    if (options.limit) {
      queryParams.append('limit', options.limit);
    }

    if (options.cursor) {
      queryParams.append('cursor', options.cursor);
    }

    const endpoint = `/obj/${dataType}?${queryParams.toString()}`;
    return this.request(endpoint);
  }

  /**
   * Get a single data record
   *
   * @param {string} dataType Data type name
   * @param {string} recordId Record unique ID
   * @returns {Promise<Object>} Single record
   */
  async getThing(dataType, recordId) {
    const endpoint = `/obj/${dataType}/${recordId}`;
    return this.request(endpoint);
  }

  /**
   * Create a new data record
   *
   * @param {string} dataType Data type name
   * @param {Object} data Record data
   * @param {string} tenantId Optional tenant ID
   * @returns {Promise<Object>} Created record
   */
  async createThing(dataType, data, tenantId) {
    const endpoint = `/obj/${dataType}`;
    const payload = { ...data };
    
    if (tenantId) {
      payload.tenant_id = tenantId;
    }

    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Update a data record
   *
   * @param {string} dataType Data type name
   * @param {string} recordId Record unique ID
   * @param {Object} data Partial record data
   * @returns {Promise<Object>} Updated record
   */
  async updateThing(dataType, recordId, data) {
    const endpoint = `/obj/${dataType}/${recordId}`;
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a data record
   *
   * @param {string} dataType Data type name
   * @param {string} recordId Record unique ID
   * @returns {Promise<boolean>} True if deletion successful
   */
  async deleteThing(dataType, recordId) {
    const endpoint = `/obj/${dataType}/${recordId}`;
    await this.request(endpoint, {
      method: 'DELETE',
    });
    return true;
  }

  /**
   * Call a Bubble workflow
   *
   * @param {string} workflowName Workflow name
   * @param {Object} parameters Workflow parameters
   * @returns {Promise<Object>} Workflow response
   */
  async callWorkflow(workflowName, parameters = {}) {
    const endpoint = `/wf/${workflowName}`;
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(parameters),
    });
  }

  /**
   * Get current user
   *
   * @returns {Promise<Object>} Current user data
   */
  async getCurrentUser() {
    return this.request('/user/current');
  }

  /**
   * Search database objects
   *
   * @param {string} dataType Data type name
   * @param {string} query Search query
   * @param {string} tenantId Optional tenant ID
   * @returns {Promise<Array>} Search results
   */
  async search(dataType, query, tenantId) {
    return this.getThings(dataType, {
      tenantId,
      constraints: [
        {
          key: 'search_term',
          constraint_type: 'contains',
          value: query,
        },
      ],
    });
  }
}

export default BubbleClient;
