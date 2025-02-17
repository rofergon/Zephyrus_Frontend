import { useRef, useEffect } from 'react';
import MessageComponent, { Message } from '../../MessageComponent';

interface ChatMessagesProps {
  messages: Message[];
  isTyping: boolean;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isTyping
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-900/50 to-gray-800/30">
      <div className="max-w-4xl mx-auto h-full flex flex-col">
        <div className="flex-1 min-h-0"></div>
        <div className="p-6 space-y-6">
          {messages.map((message) => (
            <MessageComponent key={message.id} message={message} />
          ))}
          {isTyping && (
            <MessageComponent 
              message={{
                id: 'typing',
                text: '',
                sender: 'ai',
                timestamp: Date.now(),
                isTyping: true
              }}
            />
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  );
};

export default ChatMessages; 