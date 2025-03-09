import { useRef, useEffect, useLayoutEffect, useState } from 'react';
import MessageComponent, { Message } from '../../MessageComponent';

// SVG Icons for token types
const TokenIcons = {
  ERC20: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="text-blue-400/70"/>
      <path d="M16 11.5H8M12 7.5V16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-300"/>
      <path d="M11 11.5V16.5M13 11.5V16.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-300"/>
    </svg>
  ),
  ERC721: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="text-purple-400/70"/>
      <path d="M7 7L10 10M7 7V10M7 7H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-300"/>
      <path d="M17 17L14 14M17 17V14M17 17H14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-300"/>
    </svg>
  ),
  ERC1155: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
      <rect x="3" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="text-green-400/70"/>
      <rect x="9" y="3" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="text-green-300/70"/>
      <path d="M15 15L9 9M15 9L9 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-300"/>
    </svg>
  ),
  ERC20Permit: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="text-cyan-400/70"/>
      <path d="M8 11H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-300"/>
      <rect x="10" y="7" width="4" height="3" rx="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-300"/>
      <path d="M9 10V13C9 14.6569 10.3431 16 12 16V16C13.6569 16 15 14.6569 15 13V10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-300"/>
    </svg>
  ),
  Custom: () => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
      <path d="M10.5 6H13.5M10.5 18H13.5M6 10.5V13.5M18 10.5V13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300"/>
      <path d="M3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="text-gray-400/70"/>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" className="text-gray-300"/>
    </svg>
  )
};

// Detailed descriptions for token standards tooltips
const TOKEN_TOOLTIP_INFO = {
  ERC20: {
    fullName: "ERC-20 Fungible Token Standard",
    description: "The most widely used token standard on Ethereum. Creates tokens with identical properties that can be divided (like currencies). Used for cryptocurrencies, stablecoins, and utility tokens.",
    examples: "USDC, DAI, UNI, LINK",
    useCases: "Payment tokens, governance tokens, stablecoins",
    complexity: "Low",
    gasEfficiency: "High"
  },
  ERC721: {
    fullName: "ERC-721 Non-Fungible Token Standard",
    description: "Creates tokens that are unique and cannot be divided or exchanged on a 1:1 basis. Each token has distinct properties and metadata. Used for digital art, collectibles, and unique assets.",
    examples: "CryptoPunks, Bored Ape Yacht Club, virtual real estate",
    useCases: "Digital art, collectibles, virtual land, unique identifiers",
    complexity: "Medium",
    gasEfficiency: "Medium"
  },
  ERC1155: {
    fullName: "ERC-1155 Multi-Token Standard",
    description: "Hybrid standard that can represent both fungible and non-fungible tokens in a single contract. More gas-efficient for transfers. Used for gaming items, mixed asset collections.",
    examples: "Gaming items, batch-minted collectibles, mixed token ecosystems",
    useCases: "Gaming assets, mixed collections, marketplaces",
    complexity: "Medium-High",
    gasEfficiency: "Very High"
  },
  ERC20Permit: {
    fullName: "ERC20Permit Token Standard",
    description: "Extension of the ERC20 standard that adds support for approvals via signatures (EIP-2612). Allows users to approve token spending without sending transactions, saving gas fees.",
    examples: "USDC, DAI, and many modern ERC20 tokens",
    useCases: "Gas-efficient DeFi interactions, meta-transactions, streamlined approvals",
    complexity: "Medium",
    gasEfficiency: "High"
  },
  Custom: {
    fullName: "Custom Token Implementation",
    description: "Design your own token with custom features combining elements from multiple standards. Can include custom transfer logic, access controls, or specialized features.",
    examples: "Governance tokens, specialized assets, tokens with unique mechanics",
    useCases: "Specialized applications, experimental features, custom logic",
    complexity: "Varies",
    gasEfficiency: "Varies"
  }
};

interface ContractType {
  id: string;
  icon: string;
  title: string;
  description: string;
  examples: string[];
}

interface TokenContractType {
  id: string;
  title: string;
  description: string;
  icon: string;
  bgColor: string;
}

const TOKEN_CONTRACT_TYPES: TokenContractType[] = [
  {
    id: 'erc20',
    title: 'ERC20 Token',
    description: 'Standard fungible token interface for tokens that are divisible',
    icon: 'ERC20',
    bgColor: 'from-blue-600/20 to-blue-500/10'
  },
  {
    id: 'erc721',
    title: 'ERC721 NFT',
    description: 'Non-fungible token standard for unique digital assets',
    icon: 'ERC721',
    bgColor: 'from-purple-600/20 to-purple-500/10'
  },
  {
    id: 'erc1155',
    title: 'ERC1155 Multi-Token',
    description: 'Multi-token standard for both fungible and non-fungible tokens',
    icon: 'ERC1155',
    bgColor: 'from-green-600/20 to-green-500/10'
  },
  {
    id: 'erc20permit',
    title: 'ERC20Permit Token',
    description: 'ERC20 extension with built-in signature-based approvals',
    icon: 'ERC20Permit',
    bgColor: 'from-cyan-600/20 to-cyan-500/10'
  },
  {
    id: 'custom-token',
    title: 'Custom Token',
    description: 'Create a token with custom requirements and features',
    icon: 'Custom',
    bgColor: 'from-gray-600/20 to-gray-500/10'
  }
];

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
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  
  const handleContractTypeClick = (typeId: string) => {
    if (typeId === 'token') {
      setActiveSubmenu('token');
    } else {
      const selectedType = CONTRACT_TYPES.find(type => type.id === typeId);
      if (selectedType) {
        onSelect(selectedType);
      }
    }
  };
  
  const handleTokenTypeSelect = (tokenType: TokenContractType) => {
    const baseType = CONTRACT_TYPES.find(type => type.id === 'token');
    if (baseType) {
      onSelect({
        ...baseType,
        examples: [tokenType.title, ...baseType.examples.filter(ex => ex !== tokenType.title)],
        description: tokenType.description
      });
    }
  };
  
  const handleBackToMain = () => {
    setActiveSubmenu(null);
  };
  
  if (activeSubmenu === 'token') {
    return (
      <div className="mt-4 mb-2 animate-fadeIn">
        <div className="flex items-center mb-4">
          <button 
            onClick={handleBackToMain}
            className="mr-3 text-blue-400 hover:text-blue-300 flex items-center p-2 hover:bg-blue-500/10 rounded-full transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h3 className="text-white font-medium text-lg">Select Token Contract Type:</h3>
        </div>
        <div className="grid grid-cols-1 gap-4">
          {TOKEN_CONTRACT_TYPES.map((tokenType, index) => (
            <div 
              key={tokenType.id}
              className="tooltip-container"
            >
              <button
                onClick={() => handleTokenTypeSelect(tokenType)}
                className={`flex items-center gap-5 p-5 rounded-lg border border-gray-700 hover:border-blue-500 
                  bg-gradient-to-br bg-gray-800/50 hover:bg-gray-700/50 transition-all duration-200 group text-left
                  hover:shadow-lg hover:shadow-blue-500/10 transform hover:-translate-y-0.5 animate-fade-in-up w-full`}
                style={{ animationDelay: `${index * 100}ms` }}
                aria-label={`Select ${tokenType.title}`}
              >
                <div className={`text-3xl flex-shrink-0 bg-gradient-to-br ${tokenType.bgColor} w-14 h-14 rounded-lg flex items-center justify-center 
                  shadow-inner border border-gray-700/50 group-hover:border-gray-600 group-hover:scale-110 transition-transform`}>
                  {TokenIcons[tokenType.icon as keyof typeof TokenIcons]()}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white text-lg font-medium group-hover:text-blue-400 transition-colors">{tokenType.title}</h4>
                  <p className="text-gray-400 mt-1 group-hover:text-gray-300 transition-colors">{tokenType.description}</p>
                </div>
                <div className="ml-auto self-center opacity-70 group-hover:opacity-100 transition-all group-hover:translate-x-1">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
              
              {/* Tooltip */}
              <div className="tooltip">
                <h4>{TOKEN_TOOLTIP_INFO[tokenType.icon as keyof typeof TOKEN_TOOLTIP_INFO].fullName}</h4>
                <p>{TOKEN_TOOLTIP_INFO[tokenType.icon as keyof typeof TOKEN_TOOLTIP_INFO].description}</p>
                
                <div className="tooltip-specs">
                  <div className="tooltip-spec">
                    <span className="spec-label">Common Use:</span>
                    <span className="spec-value">{TOKEN_TOOLTIP_INFO[tokenType.icon as keyof typeof TOKEN_TOOLTIP_INFO].useCases}</span>
                  </div>
                  <div className="tooltip-spec">
                    <span className="spec-label">Complexity:</span>
                    <span className="spec-value">{TOKEN_TOOLTIP_INFO[tokenType.icon as keyof typeof TOKEN_TOOLTIP_INFO].complexity}</span>
                  </div>
                  <div className="tooltip-spec">
                    <span className="spec-label">Gas Efficiency:</span>
                    <span className="spec-value">{TOKEN_TOOLTIP_INFO[tokenType.icon as keyof typeof TOKEN_TOOLTIP_INFO].gasEfficiency}</span>
                  </div>
                </div>
                
                <div className="examples">
                  <strong>Examples:</strong> {TOKEN_TOOLTIP_INFO[tokenType.icon as keyof typeof TOKEN_TOOLTIP_INFO].examples}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  return (
    <div className="mt-4 mb-2 animate-fadeIn">
      <h3 className="text-white font-medium mb-3">Choose a contract type to get started:</h3>
      <div className="grid grid-cols-1 gap-3">
        {CONTRACT_TYPES.map((type) => (
          <button
            key={type.id}
            onClick={() => handleContractTypeClick(type.id)}
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
  
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out forwards;
  }
  
  .animate-fade-in-up {
    animation: fadeInUp 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  
  .animate-pulse-light {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }
  
  /* Tooltip styles */
  .tooltip-container {
    position: relative;
  }
  
  .tooltip {
    visibility: hidden;
    position: absolute;
    z-index: 100;
    bottom: auto;
    top: 50%;
    left: calc(100% + 15px);
    transform: translateY(-50%);
    background-color: rgba(15, 23, 42, 0.95);
    color: #f1f5f9;
    padding: 14px 18px;
    border-radius: 10px;
    width: 340px;
    box-shadow: 0 15px 30px -5px rgba(0, 0, 0, 0.5);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    font-size: 14px;
    pointer-events: none;
    transform: translateY(-50%) translateX(10px);
    backdrop-filter: blur(8px);
  }
  
  .tooltip::after {
    content: "";
    position: absolute;
    top: 50%;
    right: 100%;
    margin-top: -8px;
    border-width: 8px;
    border-style: solid;
    border-color: transparent rgba(15, 23, 42, 0.95) transparent transparent;
  }
  
  .tooltip-container:hover .tooltip {
    visibility: visible;
    opacity: 1;
    transform: translateY(-50%) translateX(0);
  }
  
  .tooltip h4 {
    color: #3b82f6;
    font-weight: 600;
    margin-bottom: 8px;
    font-size: 16px;
  }
  
  .tooltip p {
    margin-bottom: 10px;
    line-height: 1.5;
  }
  
  .tooltip-specs {
    background-color: rgba(30, 41, 59, 0.5);
    border-radius: 8px;
    padding: 10px;
    margin-bottom: 12px;
    display: grid;
    gap: 8px;
  }
  
  .tooltip-spec {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
  }
  
  .spec-label {
    color: #94a3b8;
    font-weight: 500;
  }
  
  .spec-value {
    color: #e2e8f0;
    font-weight: 600;
  }
  
  /* Gas efficiency colors */
  .tooltip-spec:nth-child(3) .spec-value:contains("High") {
    color: #4ade80;
  }
  
  .tooltip-spec:nth-child(3) .spec-value:contains("Medium") {
    color: #fbbf24;
  }
  
  .tooltip-spec:nth-child(3) .spec-value:contains("Low") {
    color: #f87171;
  }
  
  .tooltip .examples {
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    padding-top: 10px;
    margin-top: 10px;
    font-style: italic;
    color: #94a3b8;
    font-size: 13px;
  }
  
  /* Responsive tooltips */
  @media (max-width: 1024px) {
    .tooltip {
      top: auto;
      bottom: calc(100% + 15px);
      left: 50%;
      transform: translateX(-50%) translateY(-10px);
      width: 280px;
    }
    
    .tooltip::after {
      top: 100%;
      right: auto;
      left: 50%;
      margin-top: 0;
      margin-left: -8px;
      border-color: rgba(15, 23, 42, 0.95) transparent transparent transparent;
    }
    
    .tooltip-container:hover .tooltip {
      transform: translateX(-50%) translateY(0);
    }
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
    
    // Extract the specific token type if selected
    let message = '';
    
    if (type.id === 'token' && type.examples[0] !== 'ERC20 Token') {
      // This means a specific token type was selected (not the default)
      const selectedTokenType = type.examples[0];
      message = `I want to create a new ${selectedTokenType}. Here are the specific features I need:
- Type: ${selectedTokenType}
- Purpose: ${type.description}
Please help me create a secure and efficient implementation.`;
    } else {
      // Default message for other contract types
      message = `I want to create a new ${type.title.toLowerCase()}. Here are the specific features I need:
- Type: ${type.examples[0]}
- Purpose: ${type.description}
Please help me create a secure and efficient implementation.`;
    }
    
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
                  showAnimation: false
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