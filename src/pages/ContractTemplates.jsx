import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const templates = [
  {
    id: 1,
    title: 'Zephyrus ERC20 Token',
    description: 'Standard ERC20 token with Zephyrus enhanced features and security',
    category: 'Token',
    features: ['Mintable', 'Burnable', 'Pausable'],
    complexity: 'Beginner',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ZephyrusToken is ERC20, Ownable {
    constructor() ERC20("ZephyrusToken", "ZEPH") {}

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }

    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
    }
}`
  },
  {
    id: 2,
    title: 'Zephyrus NFT Collection',
    description: 'Advanced ERC721 NFT collection with Zephyrus metadata support',
    category: 'NFT',
    features: ['Batch Minting', 'Metadata', 'Royalties'],
    complexity: 'Intermediate',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract ZephyrusNFT is ERC721, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    constructor() ERC721("ZephyrusNFT", "ZNFT") {}

    function mint(address to) public onlyOwner returns (uint256) {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        _safeMint(to, newTokenId);
        return newTokenId;
    }
}`
  },
  {
    id: 3,
    title: 'Zephyrus Marketplace',
    description: 'Secure decentralized marketplace powered by Zephyrus',
    category: 'DeFi',
    features: ['Multi-token', 'Auctions', 'Offers'],
    complexity: 'Advanced',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract NFTMarketplace is ReentrancyGuard {
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }

    mapping(address => mapping(uint256 => Listing)) public listings;

    function listNFT(address nftContract, uint256 tokenId, uint256 price) external {
        IERC721(nftContract).transferFrom(msg.sender, address(this), tokenId);
        listings[nftContract][tokenId] = Listing(msg.sender, price, true);
    }

    function buyNFT(address nftContract, uint256 tokenId) external payable nonReentrant {
        Listing memory listing = listings[nftContract][tokenId];
        require(listing.active, "Not for sale");
        require(msg.value >= listing.price, "Insufficient payment");
        
        listings[nftContract][tokenId].active = false;
        IERC721(nftContract).transferFrom(address(this), msg.sender, tokenId);
        payable(listing.seller).transfer(msg.value);
    }
}`
  },
  {
    id: 4,
    title: 'DAO',
    description: 'Governance contract for decentralized autonomous organizations',
    category: 'Governance',
    features: ['Voting', 'Proposals', 'Treasury'],
    complexity: 'Advanced',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";

contract MyGovernor is Governor, GovernorSettings, GovernorCountingSimple, GovernorVotes, GovernorVotesQuorumFraction {
    constructor(IVotes _token)
        Governor("MyGovernor")
        GovernorSettings(1, 50400, 0)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4)
    {}

    function votingDelay() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingDelay();
    }

    function votingPeriod() public view override(IGovernor, GovernorSettings) returns (uint256) {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber) public view override(IGovernor, GovernorVotesQuorumFraction) returns (uint256) {
        return super.quorum(blockNumber);
    }

    function proposalThreshold() public view override(Governor, GovernorSettings) returns (uint256) {
        return super.proposalThreshold();
    }
}`
  }
];

function ContractTemplates() {
  const navigate = useNavigate();

  const handleUseTemplate = (template) => {
    navigate('/chat', { state: { templateCode: template.code } });
  };

  return (
    <div className="container mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-200">
          Contract Templates
        </h1>
        <div className="flex space-x-4">
          <select className="glass-morphism px-4 py-2 rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500">
            <option value="">All Categories</option>
            <option value="token">Tokens</option>
            <option value="nft">NFTs</option>
            <option value="defi">DeFi</option>
            <option value="governance">Governance</option>
          </select>
          <select className="glass-morphism px-4 py-2 rounded-lg text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500">
            <option value="">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template, index) => (
          <motion.div
            key={template.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="glass-morphism gradient-border rounded-lg p-6"
          >
            <div className="flex justify-between items-start mb-4">
              <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-700/50 text-gray-300">
                {template.category}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                template.complexity === 'Beginner'
                  ? 'bg-emerald-900/20 text-emerald-300/90'
                  : template.complexity === 'Intermediate'
                  ? 'bg-yellow-900/20 text-yellow-300/90'
                  : 'bg-red-900/20 text-red-300/90'
              }`}>
                {template.complexity}
              </span>
            </div>
            <h2 className="text-xl font-semibold mb-2 text-gray-200">
              {template.title}
            </h2>
            <p className="text-gray-400 mb-4">
              {template.description}
            </p>
            <div className="mb-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Features:</h3>
              <div className="flex flex-wrap gap-2">
                {template.features.map((feature, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs font-medium bg-gray-800/50 text-gray-400 rounded"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={() => handleUseTemplate(template)}
                className="flex-1 glass-morphism text-gray-200 py-2 rounded-lg hover:bg-gray-700/30 transition-all duration-200"
              >
                Use Template
              </button>
              <button className="px-4 py-2 glass-morphism text-gray-300 rounded-lg hover:bg-gray-700/30 transition-all duration-200">
                Preview
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export default ContractTemplates;