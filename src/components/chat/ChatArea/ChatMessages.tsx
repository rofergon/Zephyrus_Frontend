import { useRef, useEffect, useLayoutEffect } from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);

  // Esta función de scroll usa behavior: "auto" para el scroll inicial (más inmediato)
  const scrollToBottomImmediate = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };
  
  // Esta función usa behavior: "smooth" para scrolls durante la interacción
  const scrollToBottomSmooth = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Este efecto se ejecuta solo en el montaje inicial
  useLayoutEffect(() => {
    scrollToBottomImmediate();
    // Doble scroll para asegurar que funcione correctamente, incluso con imágenes o contenido que carga lento
    setTimeout(scrollToBottomImmediate, 100);
    
    return () => {
      isInitialMount.current = false;
    };
  }, []);

  // Este efecto se ejecuta cuando cambian los mensajes
  useEffect(() => {
    if (!isInitialMount.current) {
      scrollToBottomSmooth();
    }
  }, [messages]);

  return (
    <div className="h-full overflow-y-auto" ref={containerRef}>
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-6">
        {messages.map((message) => (
          <MessageComponent 
            key={message.id} 
            message={{
              ...message,
              // Habilitamos la animación de texto solo para mensajes AI
              showAnimation: message.sender === 'ai' && !message.isTyping
            }} 
          />
        ))}
        {isTyping && (
          <MessageComponent 
            message={{
              id: 'typing',
              text: '',
              sender: 'ai',
              timestamp: Date.now(),
              isTyping: true,
              showAnimation: false
            }}
          />
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatMessages; 