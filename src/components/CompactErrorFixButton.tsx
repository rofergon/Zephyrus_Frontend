import React from 'react';
import { ErrorFix } from '../services/errorDetectionService';

interface CompactErrorFixButtonProps {
  errorFix: ErrorFix;
  onFixRequest: (errorFix: ErrorFix) => void;
}

const CompactErrorFixButton: React.FC<CompactErrorFixButtonProps> = ({ errorFix, onFixRequest }) => {
  // Function to handle button click
  const handleFixClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onFixRequest(errorFix);
  };

  return (
    <button
      onClick={handleFixClick}
      disabled={errorFix.fixed}
      className={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 transition-all duration-200 transform hover:-translate-y-0.5 
        ${errorFix.fixed 
          ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
          : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 hover:shadow-md hover:shadow-red-500/20'}`}
      title={errorFix.error}
    >
      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
      <span>{errorFix.fixed ? 'Fixing...' : 'Fix Error'}</span>
    </button>
  );
};

export default CompactErrorFixButton; 