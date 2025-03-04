import { format } from 'date-fns';
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
            // Pausa más larga al final de párrafos
            currentSpeed = typingSpeed * 10;
          } else if (/^\d+\.\s/.test(remainingText.trimStart())) {
            // Pausa antes de puntos numerados
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

  return (
    <div className={`flex justify-${isUser ? 'end' : 'start'} group animate-fade-in`}>
      {/* Avatar for AI/System messages */}
      {!isUser && (
        <div className="flex-shrink-0 mr-4">
          <div className={`w-8 h-8 rounded-lg ${
            isSystem 
              ? 'bg-red-600/20 border border-red-500/30' 
              : 'bg-blue-600/20 border border-blue-500/30'
          } flex items-center justify-center`}>
            <CommandLineIcon className={`w-5 h-5 ${
              isSystem ? 'text-red-400' : 'text-blue-400'
            }`} />
          </div>
        </div>
      )}

      <div className="flex flex-col items-start max-w-[85%] lg:max-w-[75%] min-w-[40px]">
        {/* Message Content */}
        <div 
          className={`relative rounded-2xl px-4 sm:px-6 py-4 shadow-lg ${
            isUser
              ? 'bg-blue-600 text-white ml-4 sm:ml-12'
              : isSystem
              ? 'bg-red-600/20 border border-red-500/30 text-red-200 mr-4 sm:mr-12'
              : 'bg-gradient-to-br from-gray-800 to-gray-900 text-gray-100 border border-gray-700/50 mr-4 sm:mr-12 cursor-pointer'
          }`}
          onClick={handleMessageClick}
        >
          {message.isTyping ? (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-400/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-blue-400/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-blue-400/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
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
            <div className="markdown-content">
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

          {/* Action Buttons */}
          {message.actions && message.actions.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {message.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className="px-4 py-2 text-sm bg-gray-800/80 hover:bg-gray-700 
                    text-gray-200 rounded-lg transition-all duration-200 
                    border border-gray-700/50 hover:border-gray-600/50 
                    hover:shadow-lg flex items-center space-x-2"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="flex items-center space-x-2 px-2 mt-1 text-xs text-gray-500">
          <span>{format(message.timestamp, 'HH:mm')}</span>
          <span>•</span>
          <span>
            {message.isTyping 
              ? 'Assistant is typing...'
              : isUser 
                ? 'You' 
                : isSystem 
                  ? 'System' 
                  : 'Assistant'}
          </span>
          {isAI && isAnimating && (
            <>
              <span>•</span>
              <span className="text-blue-400">typing...</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageComponent; 