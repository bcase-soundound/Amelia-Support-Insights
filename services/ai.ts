
import { GoogleGenAI, Type } from "@google/genai";
import { Ticket, TicketHistoryItem, AiAnalysisResult, GeminiModel } from '../types';

// Use a plain object for the schema to avoid potential import issues with Type definitions
const analysisSchema: any = {
  type: Type.OBJECT,
  properties: {
    score: {
      type: Type.NUMBER,
      description: "A quality score from 1 to 10 based on handling best practices.",
    },
    summary: {
      type: Type.STRING,
      description: "A concise 1-sentence summary of the ticket handling quality.",
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of positive aspects (e.g., fast response, clear communication).",
    },
    weaknesses: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of negative aspects (e.g., missed SLA, vague updates).",
    },
    rcaDetected: {
      type: Type.BOOLEAN,
      description: "True if a Root Cause Analysis was provided or discussed by a human agent.",
    },
    timeToRespond: {
      type: Type.STRING,
      description: "Calculated duration between ticket creation and first human response (e.g. '15m', '2h', '1d'). Use 'N/A' if no human response.",
    },
    timeToResolve: {
      type: Type.STRING,
      description: "Calculated duration between ticket creation and final resolution (e.g. '4h', '3d'). Use 'N/A' if not resolved.",
    }
  },
  required: ["score", "summary", "strengths", "weaknesses", "rcaDetected", "timeToRespond", "timeToResolve"],
};

export class AiService {
  private static manualApiKey: string | null = null;

  static setApiKey(key: string) {
    this.manualApiKey = key;
  }

  static getApiKey(): string | null {
    return this.manualApiKey || process.env.API_KEY || null;
  }
  
  // Update to use recommended Gemini 3 models for reasoning tasks
  static getModels(): GeminiModel[] {
    return [
      { id: 'gemini-3-flash-preview', displayName: 'Gemini 3 Flash' },
      { id: 'gemini-3-pro-preview', displayName: 'Gemini 3 Pro' },
    ];
  }

  // Validate the environment API key using the recommended model
  static async validateApiKey(): Promise<boolean> {
    const apiKey = this.getApiKey();
    if (!apiKey) return false;

    try {
      const ai = new GoogleGenAI({ apiKey });
      // Perform a minimal check to verify the key is valid and quota exists
      await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Test connection',
      });
      return true;
    } catch (e) {
      console.error("API Key Validation Failed:", e);
      throw e; // Throw so the UI can catch specific error messages
    }
  }

  /**
   * Constructs the prompt text without sending it. 
   * Useful for UI previews.
   */
  static constructPrompt(ticket: Ticket, history: TicketHistoryItem[]): string {
    const historyText = history.map(h => {
      let details = '';
      if (h.comment) {
        // Strip basic HTML for cleaner token usage
        const textContent = h.comment.content.replace(/<[^>]*>/g, ' ');
        details = `Comment: "${textContent}"`;
      } else if (h.fieldUpdates && h.fieldUpdates.length > 0) {
        details = `Updates: ${h.fieldUpdates.map(u => `${u.field} changed from ${u.oldValue} to ${u.newValue}`).join(', ')}`;
      } else {
        details = 'System/Workflow action';
      }
      return `[${h.created}] ${h.actorName || h.actorId} (${h.source}): ${details}`;
    }).join('\n');

    return `
      You are a Professional QA Auditor for Enterprise IT Support Tickets.
      Analyze the following ticket and its history to determine the quality of service provided and calculate performance metrics.
      
      TICKET METADATA:
      ID: ${ticket.ticketId}
      Created: ${ticket.created}
      Subject: ${ticket.subject}
      Priority: ${ticket.priority}
      Status: ${ticket.status}
      Client: ${ticket.ticketClientName}
      
      FULL HISTORY LOG:
      ${historyText}
      
      EVALUATION CRITERIA:
      1. Timeliness: 
         - Calculate 'timeToRespond': The time difference between ticket 'Created' and the very first human agent response or meaningful update. Ignore automated bot messages.
         - Calculate 'timeToResolve': The total time from 'Created' to when the status first hit 'RESOLVED'.
      2. Root Cause Analysis (RCA): 
         - CRITICAL: Only set rcaDetected to true if a human participant (Engineer/Agent) clearly articulates the root cause of the issue in their own words.
         - IGNORE: Do not count automated tags like "rca:" or "root cause identified".
      3. Quality Audit: Provide a score (1-10), summary, strengths, and weaknesses.
      
      Provide a strict JSON response.
    `;
  }

  static async analyzeTicket(
    ticket: Ticket, 
    history: TicketHistoryItem[], 
    modelName: string
  ): Promise<AiAnalysisResult> {
    
    const apiKey = this.getApiKey();
    if (!apiKey) throw new Error("API Key not configured");

    const ai = new GoogleGenAI({ apiKey });

    const prompt = this.constructPrompt(ticket, history);

    // Direct call using latest generateContent pattern and JSON config
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    // Access .text property directly as per latest SDK guidelines
    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from AI");
    
    const parsed = JSON.parse(jsonText);
    
    return {
      ticketId: ticket.ticketId,
      ...parsed
    };
  }
}
