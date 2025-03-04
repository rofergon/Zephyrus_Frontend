import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import MessageComponent, { Message } from '../../MessageComponent';

interface ContractType {
  id: string;
  icon: string;
  title: string;
  description: string;
  examples: string[];
}

const CONTRACT_TYPES: ContractType[] = [
  {
    id: 'token',
    icon: '🪙',
    title: 'Token Contracts',
    description: 'Create fungible or non-fungible tokens',
    examples: ['ERC20 Token', 'ERC721 NFT', 'ERC1155 Multi-Token']
  },
  {
    id: 'dao',
    icon: '🏛️',
    title: 'DAO Contracts',
    description: 'Decentralized Autonomous Organization',
    examples: ['Governance', 'Voting', 'Treasury']
  },
  {
    id: 'defi',
    icon: '💰',
    title: 'DeFi Contracts',
    description: 'Decentralized Finance applications',
    examples: ['Staking', 'Lending', 'Yield Farming']
  },
  {
    id: 'marketplace',
    icon: '🏪',
    title: 'Marketplace',
    description: 'Trade digital assets and NFTs',
    examples: ['NFT Marketplace', 'Auction House', 'Exchange']
  },
  {
    id: 'custom',
    icon: '🛠️',
    title: 'Custom Contract',
    description: 'Create a contract for your specific needs',
    examples: ['Access Control', 'Multi-sig Wallet', 'Time Lock']
  }
];

// Inline contract selector component that appears in the chat
const InlineContractSelector = ({ onSelect }: { onSelect: (type: ContractType) => void }) => {
  return (
    <div className="mt-4 mb-2 animate-fadeIn">
      <h3 className="text-white font-medium mb-3">Choose a contract type to get started:</h3>
      <div className="grid grid-cols-1 gap-3">
        {CONTRACT_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => onSelect(type)}
            className="flex items-center gap-4 p-4 rounded-lg border border-gray-700 hover:border-blue-500/50 
              bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-200 group text-left"
          >
            <div className="text-3xl flex-shrink-0 bg-gray-700/30 w-12 h-12 rounded-lg flex items-center justify-center">
              {type.icon}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-white text-lg font-medium group-hover:text-blue-400">{type.title}</h4>
              <p className="text-gray-400 mt-1">{type.description}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {type.examples.map((example) => (
                  <span 
                    key={example}
                    className="px-2 py-1 rounded-full text-xs bg-gray-700/50 text-gray-300 border border-gray-600/50"
                  >
                    {example}
                  </span>
                ))}
              </div>
            </div>
            <div className="ml-auto self-center opacity-0 group-hover:opacity-100 transition-opacity">
              <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

interface ChatMessagesProps {
  messages: Message[];
  isTyping: boolean;
}

// Add CSS animation for fade-in effect
const animationStyles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out forwards;
  }
`;

const ChatMessages: React.FC<ChatMessagesProps> = ({
  messages,
  isTyping
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInitialMount = useRef(true);
  const [showContractSelector, setShowContractSelector] = useState(false);
  const [contractSelectorMessageId, setContractSelectorMessageId] = useState<string | null>(null);

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
  }, [messages, showContractSelector]);

  const handleContractTypeSelect = (type: ContractType) => {
    setShowContractSelector(false);
    const message = `I want to create a new ${type.title.toLowerCase()}. Here are the specific features I need:
- Type: ${type.examples[0]}
- Purpose: ${type.description}
Please help me create a secure and efficient implementation.`;
    
    const event = new CustomEvent('suggest-message', { detail: message });
    window.dispatchEvent(event);
  };

  // Function to show contract selector in chat
  const showContractSelectorInChat = () => {
    // Generate a unique ID for the selector message
    const selectorId = `contract-selector-${Date.now()}`;
    setContractSelectorMessageId(selectorId);
    setShowContractSelector(true);
    
    // Scroll to the new selector after it renders
    setTimeout(scrollToBottomSmooth, 100);
  };

  // Welcome message with suggestions
  const welcomeMessage: Message = {
    id: 'welcome',
    text: `# 👋 Welcome to Zephyrus Smart Contract Assistant!

I'm here to help you create, compile, test, and deploy Solidity smart contracts on the Sonic network. Here are some things I can help you with:`,
    sender: 'ai',
    timestamp: Date.now(),
    actions: [
      {
        label: '🔨 Create a new smart contract',
        onClick: showContractSelectorInChat
      },
      {
        label: '📚 Show me contract templates',
        onClick: () => {
          const message = "Can you show me some popular smart contract templates?";
          const event = new CustomEvent('suggest-message', { detail: message });
          window.dispatchEvent(event);
        }
      },
      {
        label: '🚀 Deploy an existing contract',
        onClick: () => {
          const message = "I want to deploy a smart contract to Sonic network. What are the steps?";
          const event = new CustomEvent('suggest-message', { detail: message });
          window.dispatchEvent(event);
        }
      },
      {
        label: '🔍 Explain Sonic network',
        onClick: () => {
          const message = "Can you explain what Sonic network is and its advantages?";
          const event = new CustomEvent('suggest-message', { detail: message });
          window.dispatchEvent(event);
        }
      },
      {
        label: '💡 Smart contract best practices',
        onClick: () => {
          const message = "What are the best practices for writing secure smart contracts?";
          const event = new CustomEvent('suggest-message', { detail: message });
          window.dispatchEvent(event);
        }
      }
    ]
  };

  // Contract selector message that appears in the chat
  const contractSelectorMessage: Message = {
    id: contractSelectorMessageId || 'contract-selector',
    text: '## Choose a Smart Contract Type',
    sender: 'ai',
    timestamp: Date.now(),
    customContent: <InlineContractSelector onSelect={handleContractTypeSelect} />
  };

  return (
    <div className="h-full overflow-y-auto" ref={containerRef}>
      {/* Add animation styles */}
      <style>{animationStyles}</style>
      
      <div className="max-w-4xl mx-auto py-6 px-4 sm:px-6 space-y-6">
        {/* Show welcome message if no messages */}
        {messages.length === 0 && (
          <MessageComponent message={welcomeMessage} />
        )}
        
        {/* Render all messages */}
        {messages.map((message) => (
          <MessageComponent 
            key={message.id} 
            message={{
              ...message,
              showAnimation: message.sender === 'ai' && !message.isTyping
            }} 
          />
        ))}

        {/* Show contract selector if active */}
        {showContractSelector && (
          <MessageComponent message={contractSelectorMessage} />
        )}

        {/* Show typing indicator */}
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