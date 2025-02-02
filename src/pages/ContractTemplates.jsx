import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

const templates = [
  {
    id: 1,
    title: 'Customizable ERC20 Token',
    description: 'Advanced ERC20 token with customizable features and role-based access control',
    category: 'Token',
    features: ['Mintable', 'Burnable', 'Pausable', 'Role-Based Access Control', 'Max Supply', 'Custom Decimals'],
    complexity: 'Intermediate',
    code: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract CustomizableERC20 is ERC20, ERC20Burnable, ERC20Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    uint8 private _decimals;
    uint256 private _maxSupply;

    error InitialSupplyExceedsMaxSupply();
    error WouldExceedMaxSupply();

    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        uint8 tokenDecimals,
        uint256 initialMaxSupply
    ) ERC20(name, symbol) {
        if (initialMaxSupply != 0 && initialSupply > initialMaxSupply) revert InitialSupplyExceedsMaxSupply();
        
        _decimals = tokenDecimals;
        _maxSupply = initialMaxSupply;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);

        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply);
        }
    }

    function mint(address to, uint256 amount) public onlyRole(MINTER_ROLE) {
        if (_maxSupply != 0 && totalSupply() + amount > _maxSupply) revert WouldExceedMaxSupply();
        _mint(to, amount);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function maxSupply() public view returns (uint256) {
        return _maxSupply;
    }
}`
  },
  {
    id: 2,
    title: 'Customizable ERC721 NFT Collection',
    description: 'Advanced ERC721 NFT collection with enumerable, URI storage, and role-based access control',
    category: 'NFT',
    features: ['Mintable', 'Burnable', 'Pausable', 'Enumerable', 'URI Storage', 'Role-Based Access Control'],
    complexity: 'Intermediate',
    code: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract CustomizableERC721 is ERC721, ERC721Enumerable, ERC721URIStorage, ERC721Pausable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    
    uint256 private _nextTokenId;
    uint256 private _maxSupply;

    error MaxSupplyExceeded();
    error TokenDoesNotExist();
    error CallerNotOwnerNorApproved();

    constructor(
        string memory name,
        string memory symbol,
        uint256 maxSupply_
    ) ERC721(name, symbol) {
        _maxSupply = maxSupply_;
        
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    function safeMint(address to, string memory uri) public onlyRole(MINTER_ROLE) {
        if (_maxSupply != 0 && _nextTokenId >= _maxSupply) revert MaxSupplyExceeded();
        
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function burn(uint256 tokenId) public {
        if (_ownerOf(tokenId) == address(0)) revert TokenDoesNotExist();
        if (!_isAuthorized(_ownerOf(tokenId), msg.sender, tokenId)) revert CallerNotOwnerNorApproved();
        _burn(tokenId);
    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function maxSupply() public view returns (uint256) {
        return _maxSupply;
    }

    function totalMinted() public view returns (uint256) {
        return _nextTokenId;
    }
}`
  },
  {
    id: 3,
    title: 'Customizable DAO',
    description: 'Advanced DAO contract with proposal system, voting, and member management',
    category: 'Governance',
    features: ['Proposal System', 'Voting', 'Member Management', 'Quorum', 'Timelock', 'Reentrancy Protection'],
    complexity: 'Advanced',
    code: `// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DAO is ReentrancyGuard {
    struct Proposal {
        uint256 id;
        string description;
        address target;
        bytes data;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 snapshotTotalMembers;
        uint256 deadline;
        bool executed;
    }

    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant QUORUM_PERCENTAGE = 4;
    uint256 public constant MAJORITY_PERCENTAGE = 51;

    uint256 private nextProposalId;
    address[] private members;
    mapping(address => bool) public isMember;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public voted;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed proposalId, address indexed executor);
    event MemberJoined(address indexed member);

    modifier onlyMember() {
        require(isMember[msg.sender], "DAO: No es miembro");
        _;
    }

    modifier proposalExists(uint256 proposalId) {
        require(proposals[proposalId].id == proposalId, "DAO: Propuesta inexistente");
        _;
    }

    constructor() {
        _addMember(msg.sender);
    }

    function join() external {
        require(!isMember[msg.sender], "DAO: Ya es miembro");
        _addMember(msg.sender);
    }

    function createProposal(
        string memory _description,
        address _target,
        bytes memory _calldata
    ) external onlyMember {
        uint256 proposalId = nextProposalId++;
        
        proposals[proposalId] = Proposal({
            id: proposalId,
            description: _description,
            target: _target,
            data: _calldata,
            forVotes: 0,
            againstVotes: 0,
            snapshotTotalMembers: members.length,
            deadline: block.timestamp + VOTING_PERIOD,
            executed: false
        });

        emit ProposalCreated(proposalId, msg.sender, _description);
    }

    function vote(uint256 proposalId, bool support) external onlyMember proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        
        require(block.timestamp <= proposal.deadline, "DAO: Votacion finalizada");
        require(!voted[proposalId][msg.sender], "DAO: Ya voto");

        voted[proposalId][msg.sender] = true;
        
        if (support) {
            proposal.forVotes += 1;
        } else {
            proposal.againstVotes += 1;
        }

        emit VoteCast(proposalId, msg.sender, support);
    }

    function executeProposal(uint256 proposalId) external nonReentrant proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        
        require(block.timestamp > proposal.deadline, "DAO: Votacion activa");
        require(!proposal.executed, "DAO: Ya ejecutada");
        
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        uint256 quorum = (proposal.snapshotTotalMembers * QUORUM_PERCENTAGE) / 100;
        
        require(totalVotes >= quorum, "DAO: Quorum no alcanzado");
        require(
            proposal.forVotes * 100 > totalVotes * MAJORITY_PERCENTAGE,
            "DAO: Mayoria no alcanzada"
        );

        proposal.executed = true;
        (bool success, ) = proposal.target.call(proposal.data);
        require(success, "DAO: Ejecucion fallida");

        emit ProposalExecuted(proposalId, msg.sender);
    }

    function getMembers() external view returns (address[] memory) {
        return members;
    }

    function _addMember(address _member) private {
        isMember[_member] = true;
        members.push(_member);
        emit MemberJoined(_member);
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