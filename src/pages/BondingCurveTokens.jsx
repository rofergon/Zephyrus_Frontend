import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

function BondingCurveTokens() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const categories = ['trending', 'wnf', 'new', 'elon', 'bitcoin', 'cat'];
  
  const [tokens] = useState([
    {
      id: 1,
      name: "PUMA (PUM)",
      description: "PUMA ADDICTED - The official token for PUMA enthusiasts. Join the revolution of sports and blockchain technology. Exclusive access to limited edition sneakers and sports gear.",
      creator: "ABCDex",
      createdAt: "2h ago",
      marketCap: "$7.7K",
      replies: 43,
      image: "https://images.unsplash.com/photo-1608231387042-66d1773070a5?w=300&h=300&fit=crop"
    },
    {
      id: 2,
      name: "Open AI Agent DAO (OPENAI)",
      description: "The future of decentralized AI governance",
      creator: "BotNet",
      createdAt: "22h ago",
      marketCap: "$13.6K",
      replies: 164,
      image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=300&h=300&fit=crop"
    },
    {
      id: 3,
      name: "ECCHI (ECCHI)",
      description: "Ecchi Coin - The Steamy Meme Coin You've Been Waiting For! Welcome to Ecchi Coin, where fun meets flirty in the world of crypto!",
      creator: "BitGirl",
      createdAt: "2m ago",
      marketCap: "$7.9K",
      replies: 34,
      image: "https://images.unsplash.com/photo-1578632767115-351597cf2477?w=300&h=300&fit=crop"
    },
    {
      id: 4,
      name: "CryptoLisa (CLISA)",
      description: "Crypto-Lisa: The Mona Lisa of the Crypto World",
      creator: "ELJNXS",
      createdAt: "3h ago",
      marketCap: "$8.6K",
      replies: 112,
      image: "https://images.unsplash.com/photo-1634986666676-ec8fd927c23d?w=300&h=300&fit=crop"
    },
    {
      id: 5,
      name: "Snala stomps (SNALA)",
      description: "The famous tiktok dog SNALA Stomps! Join the cutest community in crypto.",
      creator: "ECOYST",
      createdAt: "7d ago",
      marketCap: "$11.7K",
      replies: 89,
      image: "https://images.unsplash.com/photo-1544568100-847a948585b9?w=300&h=300&fit=crop"
    },
    {
      id: 6,
      name: "Javier Milei (JMilei)",
      description: "Official Coin of Javier Milei. Supporting the libertarian movement in Argentina and worldwide. ¡Viva la libertad!",
      creator: "39yJbd",
      createdAt: "7m ago",
      marketCap: "$8.0K",
      replies: 4,
      image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop"
    },
    {
      id: 7,
      name: "Maye Musk (Musk)",
      description: "The Mother of Innovation",
      creator: "EYNXSC",
      createdAt: "2h ago",
      marketCap: "$120.9K",
      replies: 40,
      image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300&h=300&fit=crop"
    },
    {
      id: 8,
      name: "Sleepy (Zzz)",
      description: "The sleepiest shiba. A token dedicated to all the lazy dogs out there. Stake and earn while you nap!",
      creator: "FeltNap",
      createdAt: "1h ago",
      marketCap: "$35.5K",
      replies: 302,
      image: "https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=300&h=300&fit=crop"
    },
    {
      id: 9,
      name: "1kbiobye Cat (1kb)",
      description: "Cat is small",
      creator: "AweSea",
      createdAt: "5 months ago",
      marketCap: "$16.2K",
      replies: 99,
      image: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=300&h=300&fit=crop"
    },
    {
      id: 10,
      name: "SLIMY (SLIMY)",
      description: "The slimiest token on the blockchain",
      creator: "SlimeMaster",
      createdAt: "10m ago",
      marketCap: "$59.7K",
      replies: 11,
      image: "https://images.unsplash.com/photo-1519750157634-b6d493a0f77c?w=300&h=300&fit=crop"
    }
  ]);

  return (
    <div className="container mx-auto px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-orange-500 mb-2">
          king of the hill
        </h1>
        <div className="text-sm text-gray-400">
          [start a new coin]
        </div>
      </div>

      {/* Search and Categories */}
      <div className="mb-8">
        <div className="flex justify-center mb-6">
          <div className="w-full max-w-xl flex gap-2">
            <input
              type="text"
              placeholder="search for token"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 bg-green-400/20 text-gray-200 rounded-lg border border-green-400/30 focus:outline-none focus:ring-2 focus:ring-green-500/50 placeholder-gray-400"
            />
            <button className="px-6 py-2 bg-green-400/20 text-green-400 rounded-lg hover:bg-green-400/30 transition-colors">
              search
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">sort: featured</span>
            <button className="px-2 py-1 bg-gray-700/50 text-gray-300 rounded text-xs">
              ▼
            </button>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span>show animations:</span>
            <button className="px-2 py-1 bg-gray-700/50 rounded">on</button>
            <span className="mx-2">include nsfw:</span>
            <button className="px-2 py-1 bg-gray-700/50 rounded">off</button>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-4 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-1 rounded text-sm transition-colors whitespace-nowrap ${
                selectedCategory === category
                  ? 'text-gray-200'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Tokens Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {tokens.map((token) => (
          <Link to={`/bonding-tokens/${token.id}`} key={token.id}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-morphism rounded-lg overflow-hidden hover:bg-gray-800/50 transition-all duration-200 cursor-pointer"
            >
              <div className="flex gap-4 p-4">
                {/* Thumbnail */}
                <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden">
                  <img
                    src={token.image}
                    alt={token.name}
                    className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-300"
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-base font-medium text-white truncate">
                      {token.name}
                    </h3>
                    <span className="text-green-400 text-sm font-medium whitespace-nowrap">
                      {token.marketCap}
                    </span>
                  </div>

                  <p className="text-sm text-gray-300 line-clamp-2 mb-2">
                    {token.description}
                  </p>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-gray-400">
                      <span>created by</span>
                      <span className="text-blue-400">{token.creator}</span>
                      <span>•</span>
                      <span>{token.createdAt}</span>
                    </div>
                    <div className="text-gray-400">
                      {token.replies} replies
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default BondingCurveTokens;