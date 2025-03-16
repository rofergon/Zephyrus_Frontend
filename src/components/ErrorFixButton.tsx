import React from 'react';
import { ErrorFix } from '../services/errorDetectionService';

interface ErrorFixButtonProps {
  errorFix: ErrorFix;
  onFixRequest: (errorFix: ErrorFix) => void;
}

const ErrorFixButton: React.FC<ErrorFixButtonProps> = ({ errorFix, onFixRequest }) => {
  // Truncate long error messages for display
  const getDisplayError = (error: string): string => {
    if (error.length > 120) {
      return error.substring(0, 120) + '...';
    }
    return error;
  };

  // Function to handle button click
  const handleFixClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFixRequest(errorFix);
  };

  return (
    <div className="mb-4 relative">
      <div className="rounded-lg bg-gradient-to-br from-red-600/20 to-red-900/30 border border-red-500/40 p-4 shadow-lg overflow-hidden group transition-all duration-300 hover:shadow-red-500/30 transform hover:scale-[1.01]">
        <div className="flex items-start">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center mr-3">
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-grow">
            <h3 className="text-red-300 font-medium mb-1 text-sm">Compilation Error</h3>
            <p className="text-red-200/80 text-sm mb-3 font-mono">
              {getDisplayError(errorFix.error)}
            </p>
            <button
              onClick={handleFixClick}
              disabled={errorFix.fixed}
              className={`px-4 py-2 rounded bg-gradient-to-r from-red-500 to-red-600 text-white text-sm font-medium shadow hover:shadow-red-500/30 transition-all 
                ${errorFix.fixed ? 'opacity-50 cursor-not-allowed' : 'hover:from-red-600 hover:to-red-700 transform hover:-translate-y-0.5'}`}
            >
              {errorFix.fixed ? 'Fixing...' : 'Fix Error'}
            </button>
          </div>
        </div>
        
        {/* Pulsing background effect */}
        <div className="absolute inset-0 -z-10 bg-red-500/5 rounded-lg blur-xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
      </div>
    </div>
  );
};

export default ErrorFixButton; 