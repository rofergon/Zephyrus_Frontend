// Import solc wrapper
import wrapper from 'solc/wrapper';

let compiler = null;

// OpenZeppelin contract contents
const OPENZEPPELIN_CONTRACTS = {
  '@openzeppelin/contracts/token/ERC721/ERC721.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";

contract ERC721 is Context, ERC165, IERC721, IERC721Metadata {
    using Address for address;
    using Strings for uint256;

    string private _name;
    string private _symbol;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    constructor(string memory name_, string memory symbol_) {
        _name = name_;
        _symbol = symbol_;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return
            interfaceId == type(IERC721).interfaceId ||
            interfaceId == type(IERC721Metadata).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function balanceOf(address owner) public view virtual override returns (uint256) {
        require(owner != address(0), "ERC721: address zero is not a valid owner");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view virtual override returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "ERC721: invalid token ID");
        return owner;
    }

    function name() public view virtual override returns (string memory) {
        return _name;
    }

    function symbol() public view virtual override returns (string memory) {
        return _symbol;
    }

    function approve(address to, uint256 tokenId) public virtual override {
        address owner = ownerOf(tokenId);
        require(to != owner, "ERC721: approval to current owner");
        require(
            _msgSender() == owner || isApprovedForAll(owner, _msgSender()),
            "ERC721: approve caller is not token owner or approved for all"
        );
        _approve(to, tokenId);
    }

    function getApproved(uint256 tokenId) public view virtual override returns (address) {
        _requireMinted(tokenId);
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public virtual override {
        _setApprovalForAll(_msgSender(), operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view virtual override returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function _exists(uint256 tokenId) internal view virtual returns (bool) {
        return _owners[tokenId] != address(0);
    }

    function _mint(address to, uint256 tokenId) internal virtual {
        require(to != address(0), "ERC721: mint to the zero address");
        require(!_exists(tokenId), "ERC721: token already minted");

        _beforeTokenTransfer(address(0), to, tokenId);
        _balances[to] += 1;
        _owners[tokenId] = to;
        emit Transfer(address(0), to, tokenId);
        _afterTokenTransfer(address(0), to, tokenId);
    }

    function _burn(uint256 tokenId) internal virtual {
        address owner = ownerOf(tokenId);
        _beforeTokenTransfer(owner, address(0), tokenId);
        delete _tokenApprovals[tokenId];
        _balances[owner] -= 1;
        delete _owners[tokenId];
        emit Transfer(owner, address(0), tokenId);
        _afterTokenTransfer(owner, address(0), tokenId);
    }

    function _transfer(address from, address to, uint256 tokenId) internal virtual {
        require(ownerOf(tokenId) == from, "ERC721: transfer from incorrect owner");
        require(to != address(0), "ERC721: transfer to the zero address");
        _beforeTokenTransfer(from, to, tokenId);
        delete _tokenApprovals[tokenId];
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
        _afterTokenTransfer(from, to, tokenId);
    }

    function _approve(address to, uint256 tokenId) internal virtual {
        _tokenApprovals[tokenId] = to;
        emit Approval(ownerOf(tokenId), to, tokenId);
    }

    function _setApprovalForAll(address owner, address operator, bool approved) internal virtual {
        require(owner != operator, "ERC721: approve to caller");
        _operatorApprovals[owner][operator] = approved;
        emit ApprovalForAll(owner, operator, approved);
    }

    function _requireMinted(uint256 tokenId) internal view virtual {
        require(_exists(tokenId), "ERC721: invalid token ID");
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId) internal virtual {}
    function _afterTokenTransfer(address from, address to, uint256 tokenId) internal virtual {}
}`,

  '@openzeppelin/contracts/access/Ownable.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";

abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        _transferOwnership(_msgSender());
    }

    function owner() public view virtual returns (address) {
        return _owner;
    }

    modifier onlyOwner() {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
        _;
    }

    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}`,

  '@openzeppelin/contracts/utils/Strings.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Strings {
    bytes16 private constant _HEX_SYMBOLS = "0123456789abcdef";
    uint8 private constant _ADDRESS_LENGTH = 20;

    function toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function toHexString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0x00";
        }
        uint256 temp = value;
        uint256 length = 0;
        while (temp != 0) {
            length++;
            temp >>= 8;
        }
        return toHexString(value, length);
    }

    function toHexString(uint256 value, uint256 length) internal pure returns (string memory) {
        bytes memory buffer = new bytes(2 * length + 2);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 2 * length + 1; i > 1; --i) {
            buffer[i] = _HEX_SYMBOLS[value & 0xf];
            value >>= 4;
        }
        require(value == 0, "Strings: hex length insufficient");
        return string(buffer);
    }
}`,

  '@openzeppelin/contracts/utils/Context.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }
}`,

  '@openzeppelin/contracts/token/ERC721/IERC721.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface IERC721 is IERC165 {
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    
    function balanceOf(address owner) external view returns (uint256 balance);
    function ownerOf(uint256 tokenId) external view returns (address owner);
    function safeTransferFrom(address from, address to, uint256 tokenId, bytes calldata data) external;
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function setApprovalForAll(address operator, bool _approved) external;
    function getApproved(uint256 tokenId) external view returns (address operator);
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}`,

  '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC721Receiver {
    function onERC721Received(
        address operator,
        address from,
        uint256 tokenId,
        bytes calldata data
    ) external returns (bytes4);
}`,

  '@openzeppelin/contracts/token/ERC721/extensions/IERC721Metadata.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../IERC721.sol";

interface IERC721Metadata is IERC721 {
    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
}`,

  '@openzeppelin/contracts/utils/Address.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Address {
    function isContract(address account) internal view returns (bool) {
        return account.code.length > 0;
    }

    function sendValue(address payable recipient, uint256 amount) internal {
        require(address(this).balance >= amount, "Address: insufficient balance");
        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Address: unable to send value, recipient may have reverted");
    }

    function functionCall(address target, bytes memory data) internal returns (bytes memory) {
        return functionCall(target, data, "Address: low-level call failed");
    }

    function functionCall(address target, bytes memory data, string memory errorMessage) internal returns (bytes memory) {
        return functionCallWithValue(target, data, 0, errorMessage);
    }

    function functionCallWithValue(address target, bytes memory data, uint256 value) internal returns (bytes memory) {
        return functionCallWithValue(target, data, value, "Address: low-level call with value failed");
    }

    function functionCallWithValue(address target, bytes memory data, uint256 value, string memory errorMessage) internal returns (bytes memory) {
        require(address(this).balance >= value, "Address: insufficient balance for call");
        require(isContract(target), "Address: call to non-contract");
        (bool success, bytes memory returndata) = target.call{value: value}(data);
        return verifyCallResult(success, returndata, errorMessage);
    }

    function functionStaticCall(address target, bytes memory data) internal view returns (bytes memory) {
        return functionStaticCall(target, data, "Address: low-level static call failed");
    }

    function functionStaticCall(address target, bytes memory data, string memory errorMessage) internal view returns (bytes memory) {
        require(isContract(target), "Address: static call to non-contract");
        (bool success, bytes memory returndata) = target.staticcall(data);
        return verifyCallResult(success, returndata, errorMessage);
    }

    function verifyCallResult(bool success, bytes memory returndata, string memory errorMessage) internal pure returns (bytes memory) {
        if (success) {
            return returndata;
        } else {
            if (returndata.length > 0) {
                assembly {
                    let returndata_size := mload(returndata)
                    revert(add(32, returndata), returndata_size)
                }
            } else {
                revert(errorMessage);
            }
        }
    }
}`,

  '@openzeppelin/contracts/utils/introspection/IERC165.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}`,

  '@openzeppelin/contracts/utils/introspection/ERC165.sol': `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IERC165.sol";

abstract contract ERC165 is IERC165 {
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IERC165).interfaceId;
    }
}`
};

// Function to resolve imports
function findImportPath(path) {
  console.log('[Worker] Resolving import:', path);
  
  // Convert @openzeppelin to standard format if needed
  const normalizedPath = path.startsWith('./') ? path.slice(2) : path;
  
  if (OPENZEPPELIN_CONTRACTS[normalizedPath]) {
    console.log('[Worker] Found OpenZeppelin contract:', normalizedPath);
    return { contents: OPENZEPPELIN_CONTRACTS[normalizedPath] };
  }
  
  // Special handling for OpenZeppelin imports
  if (normalizedPath.startsWith('@openzeppelin/')) {
    console.log('[Worker] Import not found but is OpenZeppelin:', normalizedPath);
    return { error: `OpenZeppelin contract not found: ${normalizedPath}. Please check the import path.` };
  }
  
  console.log('[Worker] Import not found:', normalizedPath);
  return { error: `File not found: ${normalizedPath}` };
}

// Function to find the line number of an import statement
function findImportLine(sourceCode, importPath) {
  const lines = sourceCode.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(importPath)) {
      return i + 1; // Convert to 1-based line number
    }
  }
  return 1; // Default to first line if not found
}

// Load and initialize the Solidity compiler
async function initCompiler() {
  try {
    console.log('[Worker] Starting compiler initialization');
    const wasmBinaryURL = 'https://binaries.soliditylang.org/bin/soljson-v0.8.19+commit.7dd6d404.js';
    console.log('[Worker] Fetching compiler from:', wasmBinaryURL);
    
    const response = await fetch(wasmBinaryURL);
    const code = await response.text();
    console.log('[Worker] Compiler code fetched, length:', code.length);
    
    console.log('[Worker] Creating module');
    return new Promise((resolve, reject) => {
      const Module = {
        print: (text) => console.log('[Solc]', text),
        printErr: (text) => console.error('[Solc Error]', text),
        onRuntimeInitialized: () => {
          console.log('[Worker] Runtime initialized');
          try {
            console.log('[Worker] Creating wrapper');
            const solc = wrapper(Module);
            // Set up the import callback
            solc.loadRemoteVersion = (x, cb) => cb(null, solc);
            solc.importsCallback = (path) => findImportPath(path);
            
            console.log('[Worker] Testing wrapper');
            // Test the wrapper with a simple compilation
            const test = solc.compile(JSON.stringify({
              language: 'Solidity',
              sources: { 'test.sol': { content: 'pragma solidity ^0.8.19; contract Test {}' } },
              settings: { outputSelection: { '*': { '*': ['*'] } } }
            }));
            console.log('[Worker] Wrapper test successful');
            resolve(solc);
          } catch (err) {
            console.error('[Worker] Wrapper creation failed:', err);
            reject(err);
          }
        }
      };

      try {
        console.log('[Worker] Initializing module');
        const initialize = new Function('Module', code);
        initialize(Module);
      } catch (err) {
        console.error('[Worker] Module initialization failed:', err);
        reject(err);
      }
    });
  } catch (error) {
    console.error('[Worker] Compiler initialization failed:', error);
    throw error;
  }
}

// Function to analyze imports and check if they exist
function analyzeImports(sourceCode) {
  console.log('[Worker] Analyzing imports');
  const importRegex = /import\s+["'][^"']+["'];/g;
  const imports = sourceCode.match(importRegex) || [];
  console.log('[Worker] Found imports:', imports);
  return imports;
}

// Function to perform basic syntax validation
function validateSyntax(sourceCode) {
  console.log('[Worker] Starting syntax validation');
  const errors = [];
  
  // Check for SPDX license identifier
  if (!sourceCode.includes('SPDX-License-Identifier:')) {
    console.log('[Worker] Missing SPDX license identifier');
    errors.push({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
      message: 'Missing SPDX license identifier',
      severity: 3
    });
  }

  // Check for contract definition
  if (!sourceCode.includes('contract ')) {
    console.log('[Worker] Missing contract definition');
    errors.push({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1,
      message: 'No contract definition found',
      severity: 3
    });
  }

  console.log('[Worker] Syntax validation complete, found errors:', errors);
  return errors;
}

// Handle compilation requests
self.onmessage = async (event) => {
  try {
    console.log('[Worker] Received message');
    const sourceCode = event.data;
    console.log('[Worker] Source code length:', sourceCode.length);

    if (!compiler) {
      console.log('[Worker] Compiler not initialized, initializing now');
      try {
        compiler = await initCompiler();
        console.log('[Worker] Compiler initialized successfully');
      } catch (error) {
        console.error('[Worker] Failed to initialize compiler:', error);
        self.postMessage({ 
          error: 'Failed to initialize Solidity compiler: ' + error.message,
          markers: [{
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: 1,
            endColumn: 1,
            message: 'Compiler initialization failed: ' + error.message,
            severity: 8
          }]
        });
        return;
      }
    }

    console.log('[Worker] Preparing compilation input');
    const input = {
      language: 'Solidity',
      sources: {
        'Contract.sol': {
          content: sourceCode
        }
      },
      settings: {
        outputSelection: {
          '*': { '*': ['*'] }
        }
      }
    };

    console.log('[Worker] Starting compilation');
    const output = JSON.parse(compiler.compile(JSON.stringify(input)));
    console.log('[Worker] Compilation complete:', output);

    const markers = [];

    if (output.errors) {
      console.log('[Worker] Processing compilation errors');
      output.errors.forEach(error => {
        console.log('[Worker] Processing error:', error);
        
        // Handle import errors specially
        if (error.formattedMessage && error.formattedMessage.includes('File import callback not supported')) {
          const importMatch = error.formattedMessage.match(/Source "([^"]+)"/);
          if (importMatch) {
            const importPath = importMatch[1];
            const lineNumber = findImportLine(sourceCode, importPath);
            markers.push({
              startLineNumber: lineNumber,
              startColumn: 1,
              endLineNumber: lineNumber,
              endColumn: 1000,
              message: `Import not found: ${importPath}. Make sure the import path is correct.`,
              severity: 8
            });
            return;
          }
        }

        // Handle other errors with source location
        if (error.sourceLocation) {
          const lineNumber = error.sourceLocation.start;
          markers.push({
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: 1000,
            message: error.message || error.formattedMessage,
            severity: error.severity === 'error' ? 8 : 4
          });
        } else {
          // For errors without source location, try to infer from the message
          const lineMatch = error.formattedMessage.match(/Contract\.sol:(\d+):/);
          const lineNumber = lineMatch ? parseInt(lineMatch[1]) : 1;
          
          markers.push({
            startLineNumber: lineNumber,
            startColumn: 1,
            endLineNumber: lineNumber,
            endColumn: 1000,
            message: error.message || error.formattedMessage,
            severity: error.severity === 'error' ? 8 : 4
          });
        }
      });
    }

    console.log('[Worker] Final markers:', markers);
    self.postMessage({ markers, output });
  } catch (error) {
    console.error('[Worker] Error in message handler:', error);
    self.postMessage({ 
      error: error.message,
      markers: [{
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
        message: 'Compilation error: ' + error.message,
        severity: 8
      }]
    });
  }
};