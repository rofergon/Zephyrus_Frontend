import { useEffect } from 'react';
import ChatMessages from './ChatMessages';
import ChatInput from './ChatInput';
import { Message } from '../../MessageComponent';

interface ChatAreaProps {
  messages: Message[];
  input: string;
  isTyping: boolean;
  isChatMaximized: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  input,
  isTyping,
  isChatMaximized,
  onInputChange,
  onSubmit
}) => {
  // Event listener for suggestion messages
  useEffect(() => {
    const handleSuggestion = (event: CustomEvent<string>) => {
      if (event.detail) {
        onSubmit(event.detail);
      }
    };

    window.addEventListener('suggest-message', handleSuggestion as EventListener);
    
    return () => {
      window.removeEventListener('suggest-message', handleSuggestion as EventListener);
    };
  }, [onSubmit]);

  return (
    <div className="flex flex-col h-full relative">
      {/* Background elements for visual appeal */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-900 to-black opacity-80 pointer-events-none"></div>
      <div className="absolute inset-0 bg-[url('/assets/grid-pattern.svg')] bg-repeat opacity-5 pointer-events-none"></div>
      
      {/* Decorative orbs - subtle background elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl opacity-20 animate-float-slow pointer-events-none"></div>
      <div className="absolute bottom-40 right-10 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl opacity-20 animate-float-slow-reverse pointer-events-none"></div>
      
      {/* Main message area with scrollable content */}
      <div className="flex-1 overflow-y-auto relative z-10 transition-all duration-300 ease-in-out 
                      scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
        <ChatMessages 
          messages={messages}
          isTyping={isTyping}
        />
      </div>

      {/* Visual Separator with gradient */}
      <div className="h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent opacity-70 mb-1 mt-1"></div>

      {/* Fixed Input Area */}
      <div className="flex-none relative z-10">
        <ChatInput
          input={input}
          isChatMaximized={isChatMaximized}
          onInputChange={onInputChange}
          onSubmit={(text) => {
            onSubmit(text);
            onInputChange('');
          }}
        />
      </div>
      
      {/* Add required animations to global stylesheet */}
      <style>{`
        @keyframes float-slow {
          0% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0); }
        }
        @keyframes float-slow-reverse {
          0% { transform: translateY(0); }
          50% { transform: translateY(10px); }
          100% { transform: translateY(0); }
        }
        @keyframes pulse-subtle {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
        .animate-float-slow {
          animation: float-slow 15s ease-in-out infinite;
        }
        .animate-float-slow-reverse {
          animation: float-slow-reverse 18s ease-in-out infinite;
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
        
        /* Custom scrollbar for compatible browsers */
        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }
        .scrollbar-thumb-gray-700::-webkit-scrollbar-thumb {
          background-color: rgba(55, 65, 81, 0.5);
          border-radius: 3px;
        }
        .scrollbar-thumb-gray-700::-webkit-scrollbar-thumb:hover {
          background-color: rgba(55, 65, 81, 0.8);
        }
        .scrollbar-track-transparent::-webkit-scrollbar-track {
          background-color: transparent;
        }
      `}</style>
    </div>
  );
};

export default ChatArea; 