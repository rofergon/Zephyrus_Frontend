// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Importación de OpenZeppelin 4.x
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
}