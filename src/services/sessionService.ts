export interface Session {
  session_id: string;
  name: string;
  client_id: string;
  wallet_address?: string;
  created_at: string;
  last_accessed: string;
}

class SessionService {
  private baseUrl = 'http://localhost:8000/api';

  async getClientSessions(clientId: string, walletAddress?: string): Promise<Session[]> {
    try {
      console.log(`[SessionService] Fetching sessions for client: ${clientId}, wallet: ${walletAddress}`);
      const url = new URL(`${this.baseUrl}/sessions/${clientId}`);
      if (walletAddress) {
        url.searchParams.append('wallet_address', walletAddress);
      }
      console.log(`[SessionService] Request URL: ${url.toString()}`);

      const response = await fetch(url.toString());
      console.log(`[SessionService] Response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SessionService] Error response: ${errorText}`);
        throw new Error('Failed to fetch sessions');
      }

      const sessions = await response.json();
      console.log(`[SessionService] Received ${sessions.length} sessions:`, sessions);
      return sessions;
    } catch (error) {
      console.error('[SessionService] Error fetching sessions:', error);
      throw error;
    }
  }

  async createSession(clientId: string, name: string, walletAddress?: string): Promise<Session> {
    try {
      console.log(`[SessionService] Creating session for client: ${clientId}, name: ${name}, wallet: ${walletAddress}`);
      const response = await fetch(`${this.baseUrl}/sessions/${clientId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          wallet_address: walletAddress
        }),
      });
      console.log(`[SessionService] Create session response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SessionService] Error creating session: ${errorText}`);
        throw new Error('Failed to create session');
      }

      const session = await response.json();
      console.log(`[SessionService] Created session:`, session);
      return session;
    } catch (error) {
      console.error('[SessionService] Error creating session:', error);
      throw error;
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      console.log(`[SessionService] Deleting session: ${sessionId}`);
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}`, {
        method: 'DELETE',
      });
      console.log(`[SessionService] Delete session response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SessionService] Error deleting session: ${errorText}`);
        throw new Error('Failed to delete session');
      }
    } catch (error) {
      console.error('[SessionService] Error deleting session:', error);
      throw error;
    }
  }

  async renameSession(sessionId: string, newName: string): Promise<void> {
    try {
      console.log(`[SessionService] Renaming session: ${sessionId} to: ${newName}`);
      const response = await fetch(`${this.baseUrl}/sessions/${sessionId}/name`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_name: newName,
        }),
      });
      console.log(`[SessionService] Rename session response status: ${response.status}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[SessionService] Error renaming session: ${errorText}`);
        throw new Error('Failed to rename session');
      }
    } catch (error) {
      console.error('[SessionService] Error renaming session:', error);
      throw error;
    }
  }
}

export const sessionService = new SessionService(); 