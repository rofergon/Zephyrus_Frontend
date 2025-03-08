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

  // This function uses behavior: "auto" for initial scroll (more immediate)
  const scrollToBottomImmediate = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
  };
  
  // This function uses behavior: "smooth" for scrolls during interaction
  const scrollToBottomSmooth = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // This effect runs only on initial mount
  useLayoutEffect(() => {
    scrollToBottomImmediate();
    // Double scroll to ensure it works correctly, even with images or content that loads slowly
    setTimeout(scrollToBottomImmediate, 100);
    
    return () => {
      isInitialMount.current = false;
    };
  }, []);

  // This effect runs when messages change
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
    <div className="h-full overflow-y-auto bg-transparent" ref={containerRef}>
      {/* Add animation styles */}
      <style>{animationStyles}</style>
      
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-8 space-y-8">
        {/* Welcome effect - only for empty message list */}
        {messages.length === 0 && (
          <div className="animate-fade-in-slow">
            <MessageComponent message={welcomeMessage} />
          </div>
        )}
        
        {/* Render all messages */}
        <div className="space-y-6 relative">
          {messages.map((message, index) => (
            <div key={message.id} className="relative">
              {/* Decorative line connecting messages from same sender */}
              {index > 0 && messages[index-1].sender === message.sender && message.sender === 'ai' && (
                <div className="absolute left-4 -top-6 w-0.5 h-6 bg-gradient-to-b from-transparent to-blue-500/20"></div>
              )}
              
              <MessageComponent 
                message={{
                  ...message,
                  showAnimation: message.sender === 'ai' && !message.isTyping
                }} 
              />
            </div>
          ))}
        </div>

        {/* Show contract selector if active */}
        {showContractSelector && (
          <div className="animate-fade-in-up">
            <MessageComponent message={contractSelectorMessage} />
          </div>
        )}

        {/* Show typing indicator */}
        {isTyping && (
          <div className="animate-fade-in-up">
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
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Add any additional styles needed */}
      <style>{`
        @keyframes fade-in-slow {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-up {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-slow {
          animation: fade-in-slow 1s ease-out;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ChatMessages; 