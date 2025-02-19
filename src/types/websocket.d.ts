export interface WebSocketResponse {
  type: 'error' | 'message' | 'contexts_loaded' | 'context_created' | 'context_switched' | 'file_create';
  content: string;
}

export type AgentResponse = WebSocketResponse; 