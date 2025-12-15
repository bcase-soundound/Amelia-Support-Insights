import { Ticket, SearchResponse, HistoryResponse, FilterParams } from '../types';

// We use a CORS proxy because the Amelia API does not allow cross-origin requests from the browser.
// In a production app, this would be handled by a backend server/proxy.
// Default proxy URL
const DEFAULT_PROXY_URL = 'https://corsproxy.io/?';

const AUTH_URL = 'https://support.amelia.com/AmeliaRest/api/v1/aiops/token/get';
const BASE_REPORTING_URL = 'https://support.amelia.com/api/reporting/export';
const BASE_TICKET_URL = 'https://support.amelia.com/api/tickets';

export class ApiService {
  private static token: string | null = null;
  private static proxyEnabled: boolean = true;
  private static proxyUrl: string = DEFAULT_PROXY_URL;

  static setToken(token: string) {
    this.token = token;
  }

  static getToken(): string | null {
    return this.token;
  }

  static setProxyConfig(enabled: boolean, url: string) {
    this.proxyEnabled = enabled;
    this.proxyUrl = url;
  }

  static getProxyConfig() {
    return { enabled: this.proxyEnabled, url: this.proxyUrl };
  }

  // Helper to wrap URLs with the CORS proxy
  // We encode the target URL so query parameters are processed by the target API, not the proxy
  private static getProxiedUrl(targetUrl: string): string {
    if (!this.proxyEnabled) {
      return targetUrl;
    }
    return `${this.proxyUrl}${encodeURIComponent(targetUrl)}`;
  }

  static async login(username: string, password: string): Promise<string> {
    const response = await fetch(this.getProxiedUrl(AUTH_URL), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ameliaUrl: "https://support.amelia.com/Amelia",
        username,
        password
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Authentication failed: ${response.status} - ${errorText}`);
    }

    const text = await response.text();
    try {
      const json = JSON.parse(text);
      
      // Case 1: Response is a plain string (just the token)
      if (typeof json === 'string') {
        return json;
      }
      
      // Case 2: Response is a JSON object
      if (typeof json === 'object' && json !== null) {
        // 2a. Check explicit token keys, prioritizing aiOpsAccessToken as requested
        const commonKeys = ['aiOpsAccessToken', 'token', 'access_token', 'accessToken', 'data', 'sessionId', 'id_token', 'idToken'];
        for (const key of commonKeys) {
          if (json[key] && typeof json[key] === 'string') {
            return json[key];
          }
        }

        const keys = Object.keys(json);

        // 2b. Check for any key containing "token" (case insensitive)
        for (const key of keys) {
          if (key.toLowerCase().includes('token') && typeof json[key] === 'string') {
            return json[key];
          }
        }

        // 2c. Heuristic: Look for the first value that is a string and looks like a token (length > 10)
        // This avoids boolean flags or short status codes
        for (const key of keys) {
          const val = json[key];
          if (typeof val === 'string' && val.length > 15) {
            return val;
          }
        }

        // 2d. If there is exactly one value and it's a string (even if short), take it
        const values = Object.values(json);
        if (values.length === 1 && typeof values[0] === 'string') {
          return values[0] as string;
        }
        
        // If we reach here, we have an object but couldn't identify the token
        console.error("Token parsing failed. Structure:", JSON.stringify(json));
        throw new Error(`Could not find token in response: ${JSON.stringify(json)}`);
      }
      
      return String(json); 
    } catch (e) {
      // If JSON parse fails, assume the text body IS the token
      if (e instanceof SyntaxError) {
        return text;
      }
      throw e;
    }
  }

  static async searchTickets(filters: FilterParams): Promise<SearchResponse> {
    if (!this.token) throw new Error('Not authenticated');

    const queryParts: string[] = [];

    // Client Code with negation and comma-separation
    if (filters.clientCode) {
        const prefix = filters.isClientCodeNegated ? '-' : '';
        // Split by comma and trim whitespace
        const codes = filters.clientCode.split(',').map(c => c.trim()).filter(c => c.length > 0);
        
        if (codes.length === 1) {
             queryParts.push(`${prefix}ticketClientCode:${codes[0]}`);
        } else if (codes.length > 1) {
             // Join with OR logic
             const joinedCodes = codes.join(' OR ');
             queryParts.push(`${prefix}ticketClientCode:(${joinedCodes})`);
        }
    }

    if (filters.clientName) queryParts.push(`ticketClientName:${filters.clientName}`);

    // Priority Multi-select
    if (filters.priority && filters.priority.length > 0) {
        // Lucene syntax for OR: priority:(P1 OR P2)
        const pQuery = filters.priority.join(' OR ');
        queryParts.push(`priority:(${pQuery})`);
    }

    // Ticket Type Multi-select
    if (filters.ticketType && filters.ticketType.length > 0) {
        const tQuery = filters.ticketType.join(' OR ');
        queryParts.push(`ticketType:(${tQuery})`);
    }
    
    // Subject filter with negation
    if (filters.subject) {
        const prefix = filters.isSubjectNegated ? '-' : '';
        // Wrap in parentheses to handle spaces safely (e.g. subject:(system down))
        queryParts.push(`${prefix}subject:(${filters.subject})`);
    }
    
    // Date handling
    if (filters.dateFrom && filters.dateTo) {
      const from = `${filters.dateFrom}T00:00:00`;
      const to = `${filters.dateTo}T23:59:59.999`;
      queryParts.push(`created:["${from}" TO "${to}"]`);
    }

    const queryString = queryParts.join(' AND ');
    const encodedQuery = encodeURIComponent(queryString);
    
    // Construct the full target URL first
    const targetUrl = `${BASE_REPORTING_URL}?index=tasks&showTotal=true&page=0&size=50&q=${encodedQuery}`;

    // Pass the full URL to the proxy
    const response = await fetch(this.getProxiedUrl(targetUrl), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Search failed: ${response.statusText} - ${errorText}`);
    }

    return await response.json();
  }

  static async getTicketHistory(ticketId: number): Promise<HistoryResponse> {
    if (!this.token) throw new Error('Not authenticated');

    const targetUrl = `${BASE_TICKET_URL}/${ticketId}/history/all`;

    const response = await fetch(this.getProxiedUrl(targetUrl), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch history: ${response.statusText}`);
    }

    return await response.json();
  }
}