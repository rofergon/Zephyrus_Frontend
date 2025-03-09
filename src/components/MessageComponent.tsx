import { format, isValid } from 'date-fns';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CommandLineIcon } from '@heroicons/react/24/outline';
import { useState, useEffect, useRef } from 'react';

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
  showAnimation?: boolean;
  customContent?: React.ReactNode;
}

interface MessageComponentProps {
  message: Message;
}

const MessageComponent: React.FC<MessageComponentProps> = ({ message }) => {
  const isSystem = message.sender === 'system';
  const isUser = message.sender === 'user';
  const isAI = message.sender === 'ai';
  
  // States for animating AI messages
  const [displayedText, setDisplayedText] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [fullTextRevealed, setFullTextRevealed] = useState(!isAI || !message.showAnimation);
  const animationRef = useRef<NodeJS.Timeout | null>(null);
  const originalTextRef = useRef(message.text);
  
  // Character typing speed
  const typingSpeed = 3; // milliseconds per character (más rápido)
  // Code blocks and special content typing speed multiplier (faster)
  const codeBlockSpeedMultiplier = 10;
  // Heading typing speed (slower for emphasis)
  const headingSpeedMultiplier = 1.5;

  // Reset animation if message text changes
  useEffect(() => {
    if (originalTextRef.current !== message.text) {
      originalTextRef.current = message.text;
      setDisplayedText('');
      setFullTextRevealed(false);
      // Don't animate for user messages or if animation is disabled
      if (isUser || !message.showAnimation) {
        setDisplayedText(message.text);
        setFullTextRevealed(true);
      }
    }
  }, [message.text, isUser, message.showAnimation]);

  // Start animation when message is displayed and is AI message
  useEffect(() => {
    if (isAI && message.text && message.showAnimation && !fullTextRevealed) {
      setIsAnimating(true);
      
      let i = 0;
      const fullText = message.text;
      setDisplayedText('');
      
      // Clear any existing animation
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }

      // Function to animate text gradually
      const animateText = () => {
        if (i < fullText.length) {
          const nextChar = fullText[i];
          setDisplayedText(prev => prev + nextChar);
          i++;
          
          // Determine typing speed based on context
          let currentSpeed = typingSpeed;
          
          // Check the current position in the text to adjust speed
          const currentSubstring = fullText.substring(0, i);
          const remainingText = fullText.substring(i);
          
          // Faster for code blocks
          const inCodeBlock = 
            currentSubstring.includes('```') && 
            !currentSubstring.split('```').filter((_, idx) => idx % 2 === 0).pop()?.includes('```');
          
          // Slower for headings to emphasize them
          const nextIsHeading = remainingText.trimStart().match(/^#{1,6}\s/);
          
          // Check if we're at a special character or section
          if (inCodeBlock) {
            // Much faster for code blocks
            currentSpeed = typingSpeed / codeBlockSpeedMultiplier;
          } else if (nextChar === '#' || nextIsHeading) {
            // Slower for headings
            currentSpeed = typingSpeed * headingSpeedMultiplier;
          } else if (nextChar === '\n' && remainingText.startsWith('\n')) {
            // Longer pause at the end of paragraphs
            currentSpeed = typingSpeed * 10;
          } else if (/^\d+\.\s/.test(remainingText.trimStart())) {
            // Pause before numbered points
            currentSpeed = typingSpeed * 5;
          }
          
          // Schedule next character
          animationRef.current = setTimeout(animateText, currentSpeed);
        } else {
          setIsAnimating(false);
          setFullTextRevealed(true);
        }
      };
      
      // Start the animation
      animationRef.current = setTimeout(animateText, typingSpeed);
      
      // Cleanup function
      return () => {
        if (animationRef.current) {
          clearTimeout(animationRef.current);
        }
      };
    } else if (!message.showAnimation || isUser) {
      // For user messages or when animation is disabled, show full text immediately
      setDisplayedText(message.text);
      setFullTextRevealed(true);
    }
  }, [isAI, message.text, message.showAnimation, fullTextRevealed]);

  // Handle click to reveal full text immediately
  const handleMessageClick = () => {
    if (isAnimating) {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
      setDisplayedText(message.text);
      setIsAnimating(false);
      setFullTextRevealed(true);
    }
  };

  // Función para formatear el timestamp de manera segura
  const formatTimestamp = (timestamp: number | string | Date): string => {
    try {
      const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp);
      if (!isValid(date)) {
        console.warn('[MessageComponent] Invalid timestamp:', timestamp);
        return '';
      }
      return format(date, 'HH:mm');
    } catch (error) {
      console.error('[MessageComponent] Error formatting timestamp:', error);
      return '';
    }
  };

  return (
    <div className={`flex justify-${isUser ? 'end' : 'start'} group animate-fade-in mb-6`}>
      {/* Avatar for AI/System messages */}
      {!isUser && (
        <div className="flex-shrink-0 mr-4">
          <div className={`w-10 h-10 rounded-xl transform transition-all duration-300 group-hover:scale-110 ${
            isSystem 
              ? 'bg-gradient-to-br from-red-500/30 to-red-700/40 border border-red-500/40 shadow-md shadow-red-500/10' 
              : 'bg-gradient-to-br from-blue-500/30 to-indigo-600/40 border border-blue-500/40 shadow-md shadow-blue-500/10'
          } flex items-center justify-center`}>
            <CommandLineIcon className={`w-6 h-6 ${
              isSystem ? 'text-red-400' : 'text-blue-400'
            } group-hover:text-opacity-100 text-opacity-80 transition-all duration-300`} />
          </div>
        </div>
      )}

      <div className="flex flex-col items-start max-w-[85%] lg:max-w-[75%] min-w-[40px] relative group">
        {/* Time indicator - small and subtle */}
        {message.timestamp && (
          <div className={`text-[10px] text-gray-500 mb-1 font-medium opacity-0 group-hover:opacity-100 transition-opacity 
            absolute ${isUser ? 'right-0' : 'left-0'} -top-4`}>
            {formatTimestamp(message.timestamp)}
          </div>
        )}
        
        {/* Message Content */}
        <div 
          className={`relative rounded-2xl px-5 sm:px-6 py-4 shadow-lg transform transition-all duration-300 ${
            isUser
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white ml-4 sm:ml-12 group-hover:shadow-blue-500/30 hover:scale-[1.02] hover:-translate-y-0.5'
              : isSystem
              ? 'bg-gradient-to-br from-red-600/30 to-red-700/40 border border-red-500/40 text-red-100 mr-4 sm:mr-12 group-hover:shadow-red-500/20 hover:scale-[1.02] hover:-translate-y-0.5'
              : 'bg-gradient-to-br from-gray-800/95 to-gray-900/95 text-gray-100 border border-gray-700/50 mr-4 sm:mr-12 cursor-pointer group-hover:shadow-blue-500/10 hover:scale-[1.01] hover:-translate-y-0.5 hover:border-indigo-500/30'
          }`}
          onClick={handleMessageClick}
        >
          {/* Soft glow effect for AI messages */}
          {isAI && !message.isTyping && !isSystem && (
            <div className="absolute inset-0 -z-10 bg-blue-500/5 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
          )}
          
          {message.isTyping ? (
            <div className="flex items-center space-x-2 py-2">
              <div className="w-2.5 h-2.5 bg-blue-400/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2.5 h-2.5 bg-blue-400/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2.5 h-2.5 bg-blue-400/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          ) : message.customContent ? (
            <>
              {/* Render markdown text if present */}
              {message.text && (
                <div className="markdown-content mb-4">
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
                            showLineNumbers={true}
                            wrapLines={true}
                          >
                            {String(children).replace(/\n$/, '')}
                          </SyntaxHighlighter>
                        ) : (
                          <code className={`${className} bg-gray-800 rounded px-1`} {...props}>
                            {children}
                          </code>
                        );
                      },
                      h1({children, ...props}) {
                        return <h1 {...props}>{children}</h1>;
                      },
                      h2({children, ...props}) {
                        return <h2 {...props}>{children}</h2>;
                      },
                      h3({children, ...props}) {
                        return <h3 {...props}>{children}</h3>;
                      },
                      h4({children, ...props}) {
                        return <h4 {...props}>{children}</h4>;
                      },
                      p({children, ...props}) {
                        return <p {...props}>{children}</p>;
                      },
                      ul({children, ...props}) {
                        return <ul {...props}>{children}</ul>;
                      },
                      ol({children, ...props}) {
                        return <ol {...props}>{children}</ol>;
                      },
                      li({children, ...props}) {
                        return <li {...props}>{children}</li>;
                      },
                      blockquote({children, ...props}) {
                        return <blockquote {...props}>{children}</blockquote>;
                      },
                      table({children, ...props}) {
                        return <table {...props}>{children}</table>;
                      },
                      a({children, ...props}) {
                        return <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>;
                      }
                    }}
                  >
                    {isAI && message.showAnimation ? displayedText : message.text}
                  </ReactMarkdown>
                </div>
              )}
              
              {/* Render custom content */}
              <div className="custom-content">
                {message.customContent}
              </div>
            </>
          ) : (
            <div className={`prose prose-invert max-w-none ${isAnimating ? 'animate-pulse-subtle' : ''}`}>
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
                        showLineNumbers={true}
                        wrapLines={true}
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className={`${className} bg-gray-800 rounded px-1`} {...props}>
                        {children}
                      </code>
                    );
                  },
                  h1({children, ...props}) {
                    return <h1 {...props}>{children}</h1>;
                  },
                  h2({children, ...props}) {
                    return <h2 {...props}>{children}</h2>;
                  },
                  h3({children, ...props}) {
                    return <h3 {...props}>{children}</h3>;
                  },
                  h4({children, ...props}) {
                    return <h4 {...props}>{children}</h4>;
                  },
                  p({children, ...props}) {
                    return <p {...props}>{children}</p>;
                  },
                  ul({children, ...props}) {
                    return <ul {...props}>{children}</ul>;
                  },
                  ol({children, ...props}) {
                    return <ol {...props}>{children}</ol>;
                  },
                  li({children, ...props}) {
                    return <li {...props}>{children}</li>;
                  },
                  blockquote({children, ...props}) {
                    return <blockquote {...props}>{children}</blockquote>;
                  },
                  table({children, ...props}) {
                    return <table {...props}>{children}</table>;
                  },
                  a({children, ...props}) {
                    return <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>;
                  }
                }}
              >
                {isAI && message.showAnimation ? displayedText : message.text}
              </ReactMarkdown>
            </div>
          )}
          
          {/* Show a blinking cursor during animation */}
          {isAI && isAnimating && (
            <span className="inline-block h-4 w-2 bg-blue-400/80 ml-1 animate-blink"></span>
          )}

          {/* Message Actions */}
          {message.actions && message.actions.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-gray-700/50">
              {message.actions.map((action, i) => (
                <button 
                  key={i}
                  onClick={action.onClick}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-800 text-gray-300 rounded-full 
                    hover:bg-blue-600/80 hover:text-white transition-all duration-200 
                    border border-gray-700/70 hover:border-blue-500/60
                    hover:shadow-md hover:shadow-blue-500/20 transform hover:-translate-y-0.5"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Avatar for User messages */}
      {isUser && (
        <div className="flex-shrink-0 ml-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-600/40 border border-indigo-500/40 
            shadow-md shadow-indigo-500/10 flex items-center justify-center transform transition-all duration-300 group-hover:scale-110">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-indigo-400 text-opacity-80 group-hover:text-opacity-100 transition-all duration-300">
              <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageComponent; 