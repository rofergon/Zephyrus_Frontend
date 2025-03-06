import { ChangeEvent, FormEvent, KeyboardEvent, useState } from 'react';
import { PaperClipIcon, PaperAirplaneIcon, FaceSmileIcon } from '@heroicons/react/24/outline';

interface ChatInputProps {
  input: string;
  isChatMaximized: boolean;
  onInputChange: (value: string) => void;
  onSubmit: (text: string) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  isChatMaximized,
  onInputChange,
  onSubmit
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSubmit(input);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    onInputChange(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, isChatMaximized ? 200 : 288) + 'px';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        onSubmit(input);
      }
    }
  };

  return (
    <div className={`flex-none backdrop-blur-sm ${
      isChatMaximized ? 'mx-auto w-3/4 max-w-3xl' : 'mx-4'
    } mb-4 rounded-2xl shadow-xl transition-all duration-300`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="p-4">
          <div className={`relative group transition-all duration-300 ${isFocused ? 'scale-[1.02]' : ''}`}>
            <div className={`absolute inset-0 bg-gradient-to-r from-blue-500/30 via-indigo-500/30 to-purple-500/30 rounded-xl blur opacity-0 group-hover:opacity-70 transition-opacity duration-300 ${isFocused ? 'opacity-90' : ''}`}></div>
            
            <textarea
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="w-full bg-gray-900/90 text-white rounded-xl pl-4 pr-32 py-4 
                focus:outline-none focus:ring-2 focus:ring-blue-500/70 
                resize-none overflow-y-auto border border-gray-700/50
                transition-all duration-300 ease-in-out
                group-hover:border-indigo-500/40 group-hover:bg-gray-900 z-10 relative
                shadow-inner shadow-gray-900/70"
              placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
              style={{
                minHeight: '56px',
                maxHeight: '288px',
              }}
              rows={1}
            />
            
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center space-x-2 z-20">
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-gray-200 bg-gray-800/90 rounded-lg 
                  hover:bg-gray-700 transition-all duration-200 border border-gray-700/50
                  hover:border-gray-500/70 hover:shadow-lg hover:shadow-blue-500/10
                  hover:scale-105 active:scale-95"
                title="Insert emoji"
              >
                <FaceSmileIcon className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-gray-200 bg-gray-800/90 rounded-lg 
                  hover:bg-gray-700 transition-all duration-200 border border-gray-700/50
                  hover:border-gray-500/70 hover:shadow-lg hover:shadow-blue-500/10
                  hover:scale-105 active:scale-95"
                title="Attach document"
              >
                <PaperClipIcon className="w-5 h-5" />
              </button>
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2.5 text-white bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg 
                  hover:from-blue-500 hover:to-indigo-500 transition-all duration-200 
                  border border-blue-500/50 hover:border-blue-400/80
                  hover:shadow-lg hover:shadow-blue-500/20
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:from-blue-600/50 disabled:to-indigo-600/50
                  hover:scale-105 active:scale-95 font-medium flex items-center justify-center"
                title="Send message"
              >
                <PaperAirplaneIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ChatInput; 