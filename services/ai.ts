import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Ticket, TicketHistoryItem, AiAnalysisResult, GeminiModel } from '../types';

const analysisSchema: Schema = {
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
      description: "True if a Root Cause Analysis was provided or discussed.",
    },
  },
  required: ["score", "summary", "strengths", "weaknesses", "rcaDetected"],
};

export class AiService {
  
  static getModels(): GeminiModel[] {
    return [
      { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash Lite' },
    ];
  }

  static async validateApiKey(apiKey?: string): Promise<boolean> {
    const key = apiKey ? apiKey.trim().replace(/^["']|["']$/g, '') : process.env.API_KEY;
    if (!key) return false;

    try {
      const ai = new GoogleGenAI({ apiKey: key });
      // Perform a minimal check to verify the key is valid and quota exists
      await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Test connection',
      });
      return true;
    } catch (e) {
      console.error("API Key Validation Failed:", e);
      return false;
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
      You are a QA Auditor for IT Support Tickets.
      Analyze the following ticket and its history.
      
      TICKET METADATA:
      ID: ${ticket.ticketId}
      Subject: ${ticket.subject}
      Priority: ${ticket.priority}
      Status: ${ticket.status}
      Client: ${ticket.ticketClientName}
      
      FULL HISTORY LOG:
      ${historyText}
      
      Evaluate based on:
      1. Timeliness (Response time, resolution time vs priority).
      2. Transparency (Clear updates to the client).
      3. Detail (Technical depth suitable for the issue).
      4. Root Cause Analysis (Was the root cause identified?).
      5. Follow-up (Was confirmation requested before closing?).
      
      Provide a strict JSON response.
    `;
  }

  static async analyzeTicket(
    ticket: Ticket, 
    history: TicketHistoryItem[], 
    modelName: string,
    apiKey?: string
  ): Promise<AiAnalysisResult> {
    
    // Use provided key or fallback to environment variable
    const key = apiKey ? apiKey.trim().replace(/^["']|["']$/g, '') : process.env.API_KEY;
    
    if (!key) {
      throw new Error("API Key is missing. Please provide a key or configure the environment.");
    }

    // Initialize GoogleGenAI
    const ai = new GoogleGenAI({ apiKey: key });

    const prompt = this.constructPrompt(ticket, history);

    // Direct call. If this fails (401, 403, etc), it will throw an Error.
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
      },
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("Empty response from AI");
    
    const parsed = JSON.parse(jsonText);
    
    return {
      ticketId: ticket.ticketId,
      ...parsed
    };
  }
}