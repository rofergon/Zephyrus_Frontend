// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

// Import OpenZeppelin 4.x
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

    uint256 private _nextProposalId;
    address[] private _members;
    mapping(address => bool) public isMember;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public voted;

    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(uint256 indexed proposalId, address indexed executor);
    event MemberJoined(address indexed member);

    // Custom Errors
    error NotMember();
    error AlreadyMember();
    error ProposalNotFound();
    error VotingEnded();
    error AlreadyVoted();
    error VotingActive();
    error AlreadyExecuted();
    error QuorumNotReached();
    error MajorityNotReached();
    error ExecutionFailed();

    modifier onlyMember() {
        if (!isMember[msg.sender]) revert NotMember();
        _;
    }

    modifier proposalExists(uint256 proposalId) {
        if (proposals[proposalId].id != proposalId) revert ProposalNotFound();
        _;
    }

    constructor() {
        _addMember(msg.sender);
    }

    function join() external {
        if (isMember[msg.sender]) revert AlreadyMember();
        _addMember(msg.sender);
    }

    function createProposal(
        string memory _description,
        address _target,
        bytes memory _calldata
    ) external onlyMember {
        uint256 proposalId = _nextProposalId++;
        
        proposals[proposalId] = Proposal({
            id: proposalId,
            description: _description,
            target: _target,
            data: _calldata,
            forVotes: 0,
            againstVotes: 0,
            snapshotTotalMembers: _members.length,
            deadline: block.timestamp + VOTING_PERIOD,
            executed: false
        });

        emit ProposalCreated(proposalId, msg.sender, _description);
    }

    function vote(uint256 proposalId, bool support) external onlyMember proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        
        if (block.timestamp > proposal.deadline) revert VotingEnded();
        if (voted[proposalId][msg.sender]) revert AlreadyVoted();

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
        
        if (block.timestamp <= proposal.deadline) revert VotingActive();
        if (proposal.executed) revert AlreadyExecuted();
        
        uint256 totalVotes = proposal.forVotes + proposal.againstVotes;
        uint256 quorum = (proposal.snapshotTotalMembers * QUORUM_PERCENTAGE) / 100;
        
        if (totalVotes < quorum) revert QuorumNotReached();
        if (proposal.forVotes * 100 <= totalVotes * MAJORITY_PERCENTAGE) revert MajorityNotReached();

        proposal.executed = true;
        // solhint-disable-next-line avoid-low-level-calls
        // Low level call is required for DAO to execute arbitrary functions voted by members
        (bool success, ) = proposal.target.call(proposal.data);
        if (!success) revert ExecutionFailed();

        emit ProposalExecuted(proposalId, msg.sender);
    }

    function getMembers() external view returns (address[] memory) {
        return _members;
    }

    function _addMember(address _member) private {
        isMember[_member] = true;
        _members.push(_member);
        emit MemberJoined(_member);
    }
}