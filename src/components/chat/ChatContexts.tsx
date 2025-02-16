import React from 'react';
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
  return (
    <div className="flex-none border-b border-gray-700 bg-gray-800/80 backdrop-blur-sm">
      <div className="flex overflow-x-auto pb-2 px-4">
        {contexts.map((context) => (
          <div key={context.id} className="flex items-center mr-2">
            <button
              onClick={() => onContextSwitch(context.id)}
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
          onClick={onCreateNewChat}
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