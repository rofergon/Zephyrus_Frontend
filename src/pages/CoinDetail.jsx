import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';

function CoinDetail() {
  const { address } = useParams();
  const [timeframe, setTimeframe] = useState('15m');
  const [showType, setShowType] = useState('Price');

  // Datos de ejemplo
  const coinData = {
    name: "BOOBs (efe) ((efe))",
    description: "Boobs proof that men can focus on two things at once.",
    marketCap: "$97.55B",
    replies: 21,
    creator: "EtapAW",
    createdAt: "about 5 hours ago",
    contractAddress: "0x4f4D...pxrb",
    bondingProgress: 100,
    kingProgress: 100,
    holderDistribution: [
      { holder: "5qm193", percentage: "22.91%" },
      { holder: "3g34xw", percentage: "20.68%" },
      { holder: "FU6mo", percentage: "12.26%" },
      { holder: "HLBLEo", percentage: "12.05%" },
      { holder: "6afrxL", percentage: "9.27%" },
      { holder: "B7fXFL", percentage: "8.03%" },
      { holder: "YZyGXb", percentage: "3.22%" },
      { holder: "AWtoXp", percentage: "2.55%" },
      { holder: "QnUrE14", percentage: "2.55%" },
      { holder: "5K4Ygv", percentage: "2.31%" }
    ]
  };

  const timeframes = ['1s', '1m', '5m', '15m', '1h', '4h', 'D'];
  const chartTypes = ['Price', 'MCAP'];

  return (
    <div className="container mx-auto px-4">
      <div className="mb-4">
        <button className="text-gray-400 hover:text-gray-300">
          [go back]
        </button>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-700 rounded-lg"></div>
          <div>
            <h1 className="text-xl font-bold text-white mb-1">{coinData.name}</h1>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-400">created by</span>
              <span className="text-blue-400">{coinData.creator}</span>
              <span className="text-gray-400">{coinData.createdAt}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>market cap:</span>
            <span className="text-green-400">{coinData.marketCap}</span>
          </div>
          <div className="flex items-center gap-1 text-sm text-gray-400">
            <span>replies:</span>
            <span>{coinData.replies}</span>
          </div>
        </div>
      </div>

      {/* Chart Controls */}
      <div className="glass-morphism rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded text-sm ${
                  timeframe === tf
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-4">
            {chartTypes.map((type) => (
              <button
                key={type}
                onClick={() => setShowType(type)}
                className={`text-sm ${
                  showType === type ? 'text-blue-400' : 'text-gray-400'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
        
        {/* Chart Placeholder */}
        <div className="w-full h-[400px] bg-gray-800/50 rounded-lg mb-4"></div>

        {/* Trading Interface */}
        <div className="flex justify-between items-start">
          <div className="flex-1">
            {/* Trading controls would go here */}
          </div>
          <div className="w-72 glass-morphism rounded-lg p-4">
            <div className="mb-4">
              <h3 className="text-lg font-medium text-white mb-2">
                {coinData.name}
              </h3>
              <p className="text-sm text-gray-400">
                {coinData.description}
              </p>
            </div>

            {/* Progress Bars */}
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">bonding curve progress:</span>
                  <span className="text-gray-300">{coinData.bondingProgress}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full">
                  <div
                    className="h-full bg-green-400 rounded-full"
                    style={{ width: `${coinData.bondingProgress}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-400">king of the hill progress:</span>
                  <span className="text-gray-300">{coinData.kingProgress}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full">
                  <div
                    className="h-full bg-yellow-400 rounded-full"
                    style={{ width: `${coinData.kingProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Contract Address */}
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">contract address</span>
                <span className="text-blue-400">{coinData.contractAddress}</span>
              </div>
            </div>

            {/* Holder Distribution */}
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm text-gray-400">holder distribution</h4>
                <button className="text-xs text-gray-500 hover:text-gray-400">
                  generate bubble map
                </button>
              </div>
              <div className="space-y-1">
                {coinData.holderDistribution.map((holder, index) => (
                  <div key={index} className="flex justify-between text-xs">
                    <span className="text-gray-400">{index + 1}. {holder.holder}</span>
                    <span className="text-gray-300">{holder.percentage}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CoinDetail;