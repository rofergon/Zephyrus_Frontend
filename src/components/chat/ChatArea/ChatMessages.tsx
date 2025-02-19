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
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto py-6 space-y-6">
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
  );
};

export default ChatMessages; 