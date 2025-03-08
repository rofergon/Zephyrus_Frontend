import { useEffect } from 'react';
import { ChatBubbleLeftRightIcon, XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';
import { ConversationContext } from '../../services/conversationService';

interface ChatContextsProps {
  contexts: ConversationContext[];
  onContextSwitch: (contextId: string) => void;
  onContextDelete: (contextId: string) => void;
  onCreateNewChat: () => void;
}

const ChatContexts: React.FC<ChatContextsProps> = ({
  contexts,
  onContextSwitch,
  onContextDelete,
  onCreateNewChat
}) => {
  // Debug log cuando los contextos cambian
  useEffect(() => {
    console.log('[ChatContexts] Contexts updated:', contexts.length);
    
    // Verificar IDs duplicados
    const seenIds = new Set<string>();
    const duplicateIds = new Set<string>();
    
    contexts.forEach(ctx => {
      if (seenIds.has(ctx.id)) {
        duplicateIds.add(ctx.id);
        console.warn(`[ChatContexts] Duplicate context ID found: ${ctx.id}`);
      } else {
        seenIds.add(ctx.id);
      }
      
      console.log(`[ChatContexts] Context: ${ctx.id}, Name: ${ctx.name}, Active: ${ctx.active}, CreatedAt: ${ctx.createdAt}`);
    });
    
    if (duplicateIds.size > 0) {
      console.error('[ChatContexts] Duplicate context IDs detected:', Array.from(duplicateIds));
    }
  }, [contexts]);

  // Filtrar contextos duplicados antes de renderizar
  const uniqueContexts = contexts.reduce((acc: ConversationContext[], current) => {
    const exists = acc.find(ctx => ctx.id === current.id);
    if (!exists) {
      acc.push(current);
    }
    return acc;
  }, []);

  return (
    <div className="flex-none border-b border-gray-700 bg-gray-800/80 backdrop-blur-sm">
      <div className="flex overflow-x-auto pb-2 px-4">
        {uniqueContexts.length === 0 && (
          <div className="text-sm text-gray-400 py-2">
            No chats available. Create a new chat to get started.
          </div>
        )}
        
        {uniqueContexts.map((context) => (
          <div key={context.id} className="flex items-center mr-2">
            <button
              onClick={() => {
                console.log(`[ChatContexts] Switching to context: ${context.id}`);
                onContextSwitch(context.id);
              }}
              className={`group flex items-center px-4 py-2 space-x-2 border-b-2 transition-colors whitespace-nowrap rounded-t-lg ${
                context.active
                  ? 'border-blue-500 text-blue-400 bg-gray-800'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:bg-gray-800/50'
              }`}
            >
              <ChatBubbleLeftRightIcon className="w-4 h-4" />
              <span>{context.name}</span>
              {context.active && (
                <span className="ml-2 text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
                  Active
                </span>
              )}
            </button>
            <button
              onClick={() => {
                if (window.confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
                  console.log(`[ChatContexts] Deleting context: ${context.id}`);
                  onContextDelete(context.id);
                }
              }}
              className="ml-2 p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all duration-200"
              title="Delete chat permanently"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          onClick={() => {
            console.log('[ChatContexts] Creating new chat');
            onCreateNewChat();
          }}
          className="p-2 text-gray-400 hover:text-gray-300 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700/50 ml-2 flex-shrink-0"
          title="New Chat"
        >
          <PlusIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ChatContexts; 