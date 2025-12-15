
export interface TokenResponse {
  token: string;
  // Add other fields if returned by the auth endpoint, but token is primary
}

export interface Ticket {
  ticketId: number;
  ticketClientCode: string;
  ticketClientName: string;
  priority: string;
  ticketType: string;
  ticketSource: string;
  subject: string;
  status: string;
  created: string;
  updated: string;
  resolved?: string;
  lastUpdatedByEmail?: string;
  requesterEmail?: string;
}

export interface SearchResponse {
  searchResults: Ticket[];
  total: number;
}

export interface HistoryFieldUpdate {
  field: string;
  id: number;
  newValue: string;
  oldValue: string;
}

export interface HistoryComment {
  id: number;
  contentType: string;
  content: string; // HTML string
  workflowChoice?: string;
}

export interface TicketHistoryItem {
  id: number;
  created: string;
  actorId: string;
  actorName?: string; // Often null in JSON, fallback to email if available in context
  source: string; // 'workflow', 'email', etc.
  comment?: HistoryComment;
  fieldUpdates?: HistoryFieldUpdate[];
  ticketId: number;
}

export interface HistoryResponse {
  content: TicketHistoryItem[];
}

export interface FilterParams {
  clientCode: string;
  clientName: string;
  priority: string;
  ticketType: string;
  subject?: string;
  dateFrom: string;
  dateTo: string;
}

export enum ViewState {
  LOGIN,
  DASHBOARD
}

// AI Specific Types

export interface AiAnalysisResult {
  ticketId: number;
  score: number; // 0-10
  summary: string;
  strengths: string[];
  weaknesses: string[];
  rcaDetected: boolean;
  error?: string;
}

export interface GeminiModel {
  id: string;
  displayName: string;
}

export interface AiConfig {
  apiKey?: string;
  model: string;
  rpm: number;
}
