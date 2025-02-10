import React, { useState, useEffect } from 'react';
import { sessionService } from '../services/sessionService';
import { PlusIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';

interface Session {
  session_id: string;
  name: string;
  client_id: string;
  created_at: string;
  last_accessed: string;
}

interface SessionListProps {
  clientId: string | null;
  currentSessionId: string | null;
  walletAddress?: string;
  onSessionSelect: (sessionId: string) => void;
  onSessionCreate: () => void;
}

const SessionList: React.FC<SessionListProps> = ({
  clientId,
  currentSessionId,
  walletAddress,
  onSessionSelect,
  onSessionCreate
}) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const loadSessions = async () => {
    if (!clientId) {
      console.log('[SessionList] No clientId provided, skipping session load');
      return;
    }
    
    try {
      console.log(`[SessionList] Loading sessions for client: ${clientId}, wallet: ${walletAddress}`);
      setLoading(true);
      setError(null);
      const clientSessions = await sessionService.getClientSessions(clientId, walletAddress);
      console.log(`[SessionList] Loaded ${clientSessions.length} sessions:`, clientSessions);
      setSessions(clientSessions);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load sessions';
      console.error('[SessionList] Error loading sessions:', error);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[SessionList] Component mounted or clientId/walletAddress changed', { clientId, walletAddress });
    if (clientId) {
      loadSessions();
    }
  }, [clientId, walletAddress]);

  useEffect(() => {
    if (clientId) {
      console.log('[SessionList] Setting up session reload interval');
      const interval = setInterval(loadSessions, 5000);
      return () => {
        console.log('[SessionList] Clearing session reload interval');
        clearInterval(interval);
      };
    }
  }, [clientId, walletAddress]);

  const handleRename = async (sessionId: string) => {
    if (!newName.trim()) {
      setEditingSession(null);
      return;
    }

    try {
      console.log(`[SessionList] Renaming session ${sessionId} to "${newName}"`);
      await sessionService.renameSession(sessionId, newName.trim());
      await loadSessions();
      setEditingSession(null);
      setNewName('');
    } catch (error) {
      console.error('[SessionList] Error renaming session:', error);
      alert('Failed to rename session');
    }
  };

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session?')) {
      return;
    }

    try {
      console.log(`[SessionList] Deleting session ${sessionId}`);
      await sessionService.deleteSession(sessionId);
      await loadSessions();
    } catch (error) {
      console.error('[SessionList] Error deleting session:', error);
      alert('Failed to delete session');
    }
  };

  console.log('[SessionList] Rendering with state:', {
    sessions: sessions.length,
    loading,
    error,
    currentSessionId,
    editingSession
  });

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-200">Sessions</h2>
        <button
          onClick={onSessionCreate}
          className="p-2 hover:bg-gray-700 rounded-full transition-colors duration-200 flex items-center gap-2"
        >
          <PlusIcon className="w-5 h-5 text-gray-400" />
          <span className="text-gray-400">New Session</span>
        </button>
      </div>

      <div className="space-y-2">
        {sessions.map((session) => (
          <div
            key={session.session_id}
            onClick={() => onSessionSelect(session.session_id)}
            className={`p-3 rounded-lg transition-all duration-200 relative ${
              currentSessionId === session.session_id
                ? 'bg-blue-600/30 border-2 border-blue-500 shadow-lg ring-4 ring-blue-500/50 relative transform scale-[1.02]'
                : 'bg-gray-800/50 hover:bg-gray-700/50 border border-gray-700 cursor-pointer hover:scale-[1.01]'
            }`}
          >
            <div className="flex items-center justify-between">
              {editingSession === session.session_id ? (
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={() => handleRename(session.session_id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRename(session.session_id);
                    } else if (e.key === 'Escape') {
                      setEditingSession(null);
                      setNewName('');
                    }
                  }}
                  className="flex-1 bg-gray-700 text-gray-200 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              ) : (
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    {currentSessionId === session.session_id && (
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                    )}
                    <span className={`font-medium ${currentSessionId === session.session_id ? 'text-blue-300' : 'text-gray-200'}`}>
                      {session.name}
                    </span>
                    {currentSessionId === session.session_id && (
                      <span className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded-full font-semibold">
                        Current Session
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Last accessed: {new Date(session.last_accessed).toLocaleString()}
                  </div>
                </div>
              )}

              <div className="flex items-center space-x-2 ml-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingSession(session.session_id);
                    setNewName(session.name);
                  }}
                  className="group relative p-1 hover:bg-gray-600 rounded transition-colors duration-200"
                  title="Rename session"
                >
                  <PencilIcon className="w-4 h-4 text-gray-400" />
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    Rename
                  </span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(session.session_id);
                  }}
                  className="group relative p-1 hover:bg-gray-600 rounded transition-colors duration-200"
                  title="Delete session"
                >
                  <TrashIcon className="w-4 h-4 text-gray-400" />
                  <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/80 text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
                    Delete
                  </span>
                </button>
              </div>
            </div>
            {currentSessionId === session.session_id && (
              <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-blue-500 rounded-full shadow-lg" />
            )}
          </div>
        ))}

        {sessions.length === 0 && (
          <div className="text-center text-gray-400 py-8">
            <div className="mb-2">No sessions found</div>
            <button
              onClick={onSessionCreate}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Create your first session
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SessionList; 