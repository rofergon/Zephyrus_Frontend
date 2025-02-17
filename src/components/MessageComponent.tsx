import { format } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CommandLineIcon } from '@heroicons/react/24/outline';

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: number;
  actions?: Array<{
    label: string;
    onClick: () => void;
  }>;
  isTyping?: boolean;
}

interface MessageComponentProps {
  message: Message;
}

const MessageComponent: React.FC<MessageComponentProps> = ({ message }) => {
  const isAI = message.sender === 'ai';
  const isSystem = message.sender === 'system';
  const isUser = message.sender === 'user';

  return (
    <div className={`flex justify-${isUser ? 'end' : 'start'} group animate-fade-in`}>
      {/* Avatar for AI/System messages */}
      {!isUser && (
        <div className="flex-shrink-0 mr-4">
          <div className={`w-8 h-8 rounded-lg ${
            isSystem 
              ? 'bg-red-600/20 border border-red-500/30' 
              : 'bg-blue-600/20 border border-blue-500/30'
          } flex items-center justify-center`}>
            <CommandLineIcon className={`w-5 h-5 ${
              isSystem ? 'text-red-400' : 'text-blue-400'
            }`} />
          </div>
        </div>
      )}

      <div className="flex flex-col items-start max-w-[85%] lg:max-w-[75%]">
        {/* Message Content */}
        <div className={`relative rounded-2xl px-6 py-4 shadow-lg ${
          isUser
            ? 'bg-blue-600 text-white ml-12'
            : isSystem
            ? 'bg-red-600/20 border border-red-500/30 text-red-200 mr-12'
            : 'bg-gradient-to-br from-gray-800 to-gray-900 text-gray-100 border border-gray-700/50 mr-12'
        }`}>
          {message.isTyping ? (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-400/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-400/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : (
            <ReactMarkdown
              components={{
                code({className, children, ...props}) {
                  const match = /language-(\w+)/.exec(className || '');
                  const isInline = !match;
                  return !isInline && match ? (
                    <SyntaxHighlighter
                      {...props}
                      style={vscDarkPlus as any}
                      language={match[1]}
                      PreTag="div"
                      ref={undefined}
                    >
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  ) : (
                    <code className={`${className} bg-gray-800 rounded px-1`} {...props}>
                      {children}
                    </code>
                  );
                },
              }}
            >
              {message.text}
            </ReactMarkdown>
          )}

          {/* Action Buttons */}
          {message.actions && message.actions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {message.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className="px-4 py-2 text-sm bg-gray-800/80 hover:bg-gray-700 
                    text-gray-200 rounded-lg transition-all duration-200 
                    border border-gray-700/50 hover:border-gray-600/50 
                    hover:shadow-lg flex items-center space-x-2"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="flex items-center space-x-2 px-2 mt-1 text-xs text-gray-500">
          <span>{format(message.timestamp, 'HH:mm')}</span>
          <span>•</span>
          <span>
            {message.isTyping 
              ? 'Assistant is typing...'
              : isUser 
                ? 'You' 
                : isSystem 
                  ? 'System' 
                  : 'Assistant'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default MessageComponent; 