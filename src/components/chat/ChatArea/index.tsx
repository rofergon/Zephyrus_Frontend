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
  return (
    <>
      <ChatMessages 
        messages={messages}
        isTyping={isTyping}
      />

      {/* Visual Separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-gray-700/50 to-transparent"></div>

      <ChatInput
        input={input}
        isChatMaximized={isChatMaximized}
        onInputChange={onInputChange}
        onSubmit={(text) => {
          onSubmit(text);
          onInputChange('');
        }}
      />
    </>
  );
};

export default ChatArea; 