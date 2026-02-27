
export interface TokenResponse {
  token: string;
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
  actorName?: string;
  source: string;
  comment?: HistoryComment;
  fieldUpdates?: HistoryFieldUpdate[];
  ticketId: number;
}

export interface HistoryResponse {
  content: TicketHistoryItem[];
}

export interface FilterParams {
  clientCode: string;
  isClientCodeNegated?: boolean;
  clientName: string;
  priority: string[];
  ticketType: string[];
  subject?: string;
  isSubjectNegated?: boolean;
  dateFrom: string;
  dateTo: string;
  ticketIds?: string; // New field for bulk ID lists
}

export enum ViewState {
  LOGIN,
  DASHBOARD
}

export interface AiAnalysisResult {
  ticketId: number;
  score: number;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  rcaDetected: boolean;
  timeToRespond?: string;
  timeToResolve?: string;
  error?: string;
}

export interface GeminiModel {
  id: string;
  displayName: string;
}

export interface AiConfig {
  model: string;
  rpm: number;
}

