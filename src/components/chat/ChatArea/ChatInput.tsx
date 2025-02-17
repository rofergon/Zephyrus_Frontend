import { ChangeEvent, FormEvent, KeyboardEvent } from 'react';
import { PaperClipIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';

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
    <div className={`flex-none bg-gradient-to-b from-gray-800/95 to-gray-900/95 backdrop-blur-sm ${
      isChatMaximized ? 'mx-auto w-3/4 max-w-3xl' : 'mx-4'
    } mb-4 rounded-2xl shadow-lg border border-gray-700/50`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="p-4">
          <div className="relative group">
            <textarea
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              className="w-full bg-gray-900/80 text-white rounded-xl pl-4 pr-24 py-3.5 
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 
                resize-none overflow-y-auto border border-gray-700/50
                transition-all duration-200
                group-hover:border-gray-600/50 group-hover:bg-gray-900/90"
              placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
              style={{
                minHeight: '48px',
                maxHeight: '288px',
              }}
              rows={1}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-2">
              <button
                type="button"
                className="p-2 text-gray-400 hover:text-gray-300 bg-gray-800/80 rounded-lg 
                  hover:bg-gray-700 transition-all duration-200 border border-gray-700/50
                  hover:border-gray-600/50 hover:shadow-lg"
                title="Attach document"
              >
                <PaperClipIcon className="w-5 h-5" />
              </button>
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2 text-blue-400 hover:text-blue-300 bg-blue-500/10 rounded-lg 
                  hover:bg-blue-500/20 transition-all duration-200 border border-blue-500/30
                  hover:border-blue-500/50 hover:shadow-lg
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-500/10"
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