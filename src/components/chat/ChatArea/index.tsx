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
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <ChatMessages 
          messages={messages}
          isTyping={isTyping}
        />
      </div>

      {/* Visual Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent"></div>

      {/* Fixed Input Area */}
      <div className="flex-none">
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
    </div>
  );
};

export default ChatArea; 