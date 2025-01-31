import React, { useState } from 'react';

function ImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [images, setImages] = useState([]);

  const handleGenerate = () => {
    setIsGenerating(true);
    // Simulate image generation
    setTimeout(() => {
      const mockImages = [
        'https://via.placeholder.com/300/1a1a1a/ffffff?text=Token+1',
        'https://via.placeholder.com/300/1a1a1a/ffffff?text=Token+2',
        'https://via.placeholder.com/300/1a1a1a/ffffff?text=Token+3',
        'https://via.placeholder.com/300/1a1a1a/ffffff?text=Token+4',
      ];
      setImages(mockImages);
      setIsGenerating(false);
    }, 2000);
  };

  return (
    <div className="container mx-auto">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 border border-gray-700 mb-6">
        <h2 className="text-xl font-bold mb-4 text-white">
          Token Image Generator
        </h2>
        <div className="mb-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Describe your token image... (e.g., A modern, minimalist logo featuring a golden cryptocurrency symbol with blue accents)"
            rows="4"
          />
        </div>
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className={`w-full py-3 rounded-lg text-white font-medium transition-all duration-200 ${
            isGenerating || !prompt.trim()
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isGenerating ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Generating Images...
            </span>
          ) : (
            'Generate Images'
          )}
        </button>
      </div>
      
      {images.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {images.map((image, index) => (
            <div
              key={index}
              className="bg-gray-800 rounded-lg shadow-xl p-4 border border-gray-700 hover:border-blue-500 transition-all duration-200"
            >
              <div className="relative aspect-square mb-4 overflow-hidden rounded-lg">
                <img
                  src={image}
                  alt={`Generated ${index + 1}`}
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="flex space-x-2">
                <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
                  Select
                </button>
                <button className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors duration-200">
                  ↓
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ImageGenerator;