import { SearchResponse, HistoryResponse, FilterParams } from '../types';

// We use a CORS proxy because the Amelia API does not allow cross-origin requests from the browser.
const DEFAULT_PROXY_URL = 'https://corsproxy.io/?';

const AUTH_URL = 'https://support.amelia.com/AmeliaRest/api/v1/aiops/token/get';
const BASE_REPORTING_URL = 'https://support.amelia.com/api/reporting/export';
const BASE_TICKET_URL = 'https://support.amelia.com/api/tickets';

export class ApiService {
  private static token: string | null = null;
  private static proxyEnabled: boolean = !(window.location.hostname === 'localhost' || window.location.hostname.endsWith('.run.app'));
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

  private static getProxiedUrl(targetUrl: string): string {
    if (!this.proxyEnabled) {
      // Local proxy mode: convert full URL to relative path for Vite proxy
      return targetUrl.replace('https://support.amelia.com', '');
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
      if (typeof json === 'string') return json;
      if (typeof json === 'object' && json !== null) {
        const commonKeys = ['aiOpsAccessToken', 'token', 'access_token', 'accessToken'];
        for (const key of commonKeys) {
          if (json[key] && typeof json[key] === 'string') return json[key];
        }
        const values = Object.values(json);
        for (const val of values) {
          if (typeof val === 'string' && val.length > 15) return val;
        }
      }
      return text;
    } catch (e) {
      return text;
    }
  }

  static async searchTickets(filters: FilterParams): Promise<SearchResponse> {
    if (!this.token) throw new Error('Not authenticated');

    const queryParts: string[] = [];

    // Specific Ticket IDs (Bulk Mode)
    // Supports comma, newline, or space as delimiters
    let hasSpecificIds = false;
    if (filters.ticketIds) {
      const ids = filters.ticketIds
        .split(/[\s,]+/)
        .map(id => id.trim())
        .filter(id => id.length > 0 && !isNaN(Number(id)));
      
      if (ids.length > 0) {
        hasSpecificIds = true;
        if (ids.length === 1) {
          queryParts.push(`ticketId:${ids[0]}`);
        } else {
          // Using explicit (field:val OR field:val) for better compatibility with different Lucene parsers
          const idClauses = ids.map(id => `ticketId:${id}`).join(' OR ');
          queryParts.push(`(${idClauses})`);
        }
      }
    }

    // Client Code with negation and comma-separation
    if (filters.clientCode) {
        const prefix = filters.isClientCodeNegated ? '-' : '';
        const codes = filters.clientCode.split(',').map(c => c.trim()).filter(c => c.length > 0);
        if (codes.length === 1) {
             queryParts.push(`${prefix}ticketClientCode:${codes[0]}`);
        } else if (codes.length > 1) {
             const joinedCodes = codes.join(' OR ');
             queryParts.push(`${prefix}ticketClientCode:(${joinedCodes})`);
        }
    }

    if (filters.clientName) queryParts.push(`ticketClientName:${filters.clientName}`);

    if (filters.priority && filters.priority.length > 0) {
        const pQuery = filters.priority.join(' OR ');
        queryParts.push(`priority:(${pQuery})`);
    }

    if (filters.ticketType && filters.ticketType.length > 0) {
        const tQuery = filters.ticketType.join(' OR ');
        queryParts.push(`ticketType:(${tQuery})`);
    }
    
    if (filters.subject) {
        const prefix = filters.isSubjectNegated ? '-' : '';
        queryParts.push(`${prefix}subject:(${filters.subject})`);
    }
    
    // When searching for specific IDs, we bypass the date range filter
    // as users usually want to find those records regardless of age.
    if (!hasSpecificIds && filters.dateFrom && filters.dateTo) {
      const from = `${filters.dateFrom}T00:00:00`;
      const to = `${filters.dateTo}T23:59:59.999`;
      queryParts.push(`created:["${from}" TO "${to}"]`);
    }

    const queryString = queryParts.length > 0 ? queryParts.join(' AND ') : '*:*';
    const encodedQuery = encodeURIComponent(queryString);
    
    // Increased page size to 100 for better bulk visibility
    const targetUrl = `${BASE_REPORTING_URL}?index=tasks&showTotal=true&page=0&size=100&q=${encodedQuery}`;

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
    if (!response.ok) throw new Error(`Failed to fetch history: ${response.statusText}`);
    return await response.json();
  }
}