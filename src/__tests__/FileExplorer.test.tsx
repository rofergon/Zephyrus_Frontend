import React from 'react';
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import FileExplorer from '../components/FileExplorer';
import { virtualFS } from '../services/virtual-fs';

// Constante para localStorage key
const SELECTED_FILE_KEY = 'fileExplorer_selectedFile';

// Mock the virtualFS
vi.mock('../services/virtual-fs', () => ({
  virtualFS: {
    listFiles: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    deleteFile: vi.fn(),
    exists: vi.fn(),
    moveFile: vi.fn(),
    moveDirectory: vi.fn(),
    isInitialized: vi.fn().mockResolvedValue(true),
    getFiles: vi.fn()
  }
}));

// Mock localStorage for session persistence
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key]),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    length: 0,
    key: vi.fn((index: number) => Object.keys(store)[index] || null)
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

describe('FileExplorer Component', () => {
  // Sample file structure for testing
  const mockFileStructure = [
    {
      name: 'contracts',
      path: 'contracts',
      type: 'directory' as const,
      children: [
        {
          name: 'Contract.sol',
          path: 'contracts/Contract.sol',
          type: 'file' as const
        },
        {
          name: 'AnotherContract.sol',
          path: 'contracts/AnotherContract.sol',
          type: 'file' as const
        }
      ]
    },
    {
      name: 'scripts',
      path: 'scripts',
      type: 'directory' as const,
      children: [
        {
          name: 'deploy.js',
          path: 'scripts/deploy.js',
          type: 'file' as const
        }
      ]
    }
  ];

  // Mock contract file content
  const mockContractContent = 'pragma solidity ^0.8.0;\n\ncontract TestContract {\n  // Test contract\n}';

  const onFileSelectMock = vi.fn();

  beforeEach(() => {
    // Setup mocks
    vi.mocked(virtualFS.listFiles).mockResolvedValue(mockFileStructure);
    vi.mocked(virtualFS.readFile).mockImplementation(async (path: string) => {
      if (path === 'contracts/Contract.sol') {
        return mockContractContent;
      }
      throw new Error(`File not found: ${path}`);
    });
    vi.mocked(virtualFS.exists).mockResolvedValue(true);

    // Reset mocks
    vi.clearAllMocks();
    localStorageMock.clear();
    
    // Reset document.visibilityState
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should load and display files on initial render', async () => {
    await act(async () => {
      render(
        <FileExplorer 
          onFileSelect={onFileSelectMock} 
          selectedFile={null} 
        />
      );
    });

    // Initial loading state
    expect(screen.getByText(/contracts/i)).toBeInTheDocument();
    
    // Verify virtualFS.listFiles was called - note that in our implementation it may be called multiple times
    // due to the effect dependencies, so we verify it's called at least once
    expect(virtualFS.listFiles).toHaveBeenCalled();
  });

  it('should remember selected file between renders', async () => {
    const selectedFilePath = 'contracts/Contract.sol';
    
    // First render with a selected file
    let rerender: any;
    
    await act(async () => {
      const { rerender: rerenderFn } = render(
        <FileExplorer 
          onFileSelect={onFileSelectMock} 
          selectedFile={selectedFilePath} 
        />
      );
      rerender = rerenderFn;
    });

    // Find the file item element by its text
    const fileElement = await screen.findByText('Contract.sol');
    expect(fileElement).toBeInTheDocument();
    
    // Find the parent div that contains the file element
    const fileParent = fileElement.closest('div[class*="bg-blue-500"]');
    // Note: We changed the expected class for selection to match what the component actually uses
    expect(fileParent).not.toBeNull();
    
    // Simulate a rerender of the component as if parent state changed
    await act(async () => {
      rerender(
        <FileExplorer 
          onFileSelect={onFileSelectMock} 
          selectedFile={selectedFilePath} 
        />
      );
    });
    
    // Selected file should still be marked
    const fileElementAfterRerender = await screen.findByText('Contract.sol');
    const fileParentAfterRerender = fileElementAfterRerender.closest('div[class*="bg-blue-500"]');
    expect(fileParentAfterRerender).not.toBeNull();
  });

  it('should handle file not found when selected file no longer exists', async () => {
    // Setup: virtualFS.exists returns false for the selected file
    vi.mocked(virtualFS.exists).mockImplementation(async (path: string) => {
      return path !== 'contracts/MissingContract.sol';
    });
    
    const selectedFilePath = 'contracts/MissingContract.sol';
    
    await act(async () => {
      render(
        <FileExplorer 
          onFileSelect={onFileSelectMock} 
          selectedFile={selectedFilePath} 
        />
      );
    });
    
    // Should have called exists on the missing file
    expect(virtualFS.exists).toHaveBeenCalledWith(selectedFilePath);
    
    // Optional: check if onFileSelect was called to reset the selection
    // This assumes your component would reset the selection when a file doesn't exist
    await waitFor(() => {
      expect(onFileSelectMock).toHaveBeenCalledWith(null);
    });
  });

  it('should refresh file list when visibility changes (simulating reload)', async () => {
    await act(async () => {
      render(
        <FileExplorer 
          onFileSelect={onFileSelectMock} 
          selectedFile="contracts/Contract.sol" 
        />
      );
    });
    
    // Reset the mock to track new calls
    vi.mocked(virtualFS.listFiles).mockClear();
    
    // Simulate document becoming visible again (like after a reload)
    await act(async () => {
      // Create and dispatch a visibilitychange event
      const visibilityEvent = new Event('visibilitychange');
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true
      });
      document.dispatchEvent(visibilityEvent);
    });
    
    // Should have called listFiles again
    expect(virtualFS.listFiles).toHaveBeenCalled();
  });

  it('should handle file structure changes during reload', async () => {
    // First render with initial file structure
    await act(async () => {
      render(
        <FileExplorer 
          onFileSelect={onFileSelectMock} 
          selectedFile="contracts/Contract.sol" 
        />
      );
    });
    
    // Change the mock to return a different file structure for the second call
    const updatedFileStructure = JSON.parse(JSON.stringify(mockFileStructure));
    // Add a new file to the structure
    if (updatedFileStructure[0].children) {
      updatedFileStructure[0].children.push({
        name: 'ReplacementContract.sol',
        path: 'contracts/ReplacementContract.sol',
        type: 'file'
      });
    }
    
    vi.mocked(virtualFS.listFiles).mockResolvedValue(updatedFileStructure);
    
    // Simulate a reload by changing visibility
    await act(async () => {
      const visibilityEvent = new Event('visibilitychange');
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true
      });
      document.dispatchEvent(visibilityEvent);
    });
    
    // Wait for the component to update with the new file structure
    await waitFor(() => {
      expect(screen.getByText('ReplacementContract.sol')).toBeInTheDocument();
    });
  });

  // Tests for persistence and reloads
  it('should save selected file to localStorage and restore it after reload', async () => {
    const selectedFilePath = 'contracts/Contract.sol';
    
    // First render with initial selection
    await act(async () => {
      render(
        <FileExplorer 
          onFileSelect={onFileSelectMock} 
          selectedFile={selectedFilePath} 
        />
      );
    });

    // Check that localStorage.setItem was called with the selected file path
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      SELECTED_FILE_KEY, 
      selectedFilePath
    );
    
    // Simulate a page reload by unmounting and remounting the component
    // First, store what was saved in localStorage
    
    // Unmount
    await act(async () => {
      render(<></>);
    });
    
    // Reset onFileSelect mock to track new calls
    onFileSelectMock.mockClear();
    
    // Remount component without explicitly providing selectedFile
    // It should read from localStorage instead
    await act(async () => {
      render(
        <FileExplorer 
          onFileSelect={onFileSelectMock} 
          selectedFile={null} 
        />
      );
    });
    
    // Component should call onFileSelect with the stored path on mount
    await waitFor(() => {
      expect(onFileSelectMock).toHaveBeenCalledWith(selectedFilePath);
    });
  });

  it('should handle case where selected file is not found in virtualFS after reload', async () => {
    // First render: set and save a file selection
    const selectedFilePath = 'contracts/OldContract.sol';
    
    // Setup: virtualFS.exists returns false for the selected file path
    vi.mocked(virtualFS.exists).mockImplementation(async (path: string) => {
      return path !== selectedFilePath;
    });
    
    // Mock localStorage to have a stored selected file
    localStorageMock.getItem.mockImplementation((key: string) => {
      if (key === SELECTED_FILE_KEY) return selectedFilePath;
      return null;
    });
    
    // Now render component, it should try to restore the selection
    await act(async () => {
      render(
        <FileExplorer 
          onFileSelect={onFileSelectMock} 
          selectedFile={null} // No explicit selection, should try to read from localStorage
        />
      );
    });
    
    // Verificar que se comprobó la existencia del archivo
    await waitFor(() => {
      expect(virtualFS.exists).toHaveBeenCalled();
    });
    
    // Should notify that file no longer exists
    await waitFor(() => {
      expect(onFileSelectMock).toHaveBeenCalledWith(null);
    });
    
    // Should show an error or notification to the user
    // Note: This assumes the component shows some kind of error, modify based on actual implementation
    await waitFor(() => {
      const errorElement = screen.queryByText(/no longer exists/i);
      expect(errorElement).not.toBeNull();
    }, { timeout: 3000 });
  });

  it('should verify file existence on each reload', async () => {
    // Setup: first render with existing file
    const selectedFilePath = 'contracts/Contract.sol';
    vi.mocked(virtualFS.exists).mockResolvedValue(true);
    
    await act(async () => {
      render(
        <FileExplorer 
          onFileSelect={onFileSelectMock} 
          selectedFile={selectedFilePath}
        />
      );
    });
    
    // Initial existence check
    expect(virtualFS.exists).toHaveBeenCalled();
    vi.mocked(virtualFS.exists).mockClear();
    
    // Now simulate reload, but the file still exists
    await act(async () => {
      const visibilityEvent = new Event('visibilitychange');
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true
      });
      document.dispatchEvent(visibilityEvent);
    });
    
    // Should verify file still exists
    await waitFor(() => {
      expect(virtualFS.exists).toHaveBeenCalled();
    });
    vi.mocked(virtualFS.exists).mockClear();
    
    // Now change the mock so file no longer exists
    vi.mocked(virtualFS.exists).mockResolvedValue(false);
    
    // Simulate another reload
    await act(async () => {
      const visibilityEvent = new Event('visibilitychange');
      document.dispatchEvent(visibilityEvent);
    });
    
    // Should verify again and call onFileSelect(null) since file is gone
    await waitFor(() => {
      expect(virtualFS.exists).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(onFileSelectMock).toHaveBeenCalledWith(null);
    });
  });

  it('should modify the UI based on virtual file system changes', async () => {
    // Initial render with a file structure including Contract.sol
    await act(async () => {
      render(
        <FileExplorer 
          onFileSelect={onFileSelectMock} 
          selectedFile="contracts/Contract.sol" 
        />
      );
    });
    
    // Verify the initial file is shown
    expect(screen.getByText('Contract.sol')).toBeInTheDocument();
    
    // Now update the mock to return a structure without Contract.sol
    const updatedFileStructure = JSON.parse(JSON.stringify(mockFileStructure));
    if (updatedFileStructure[0].children) {
      // Remove Contract.sol
      updatedFileStructure[0].children = updatedFileStructure[0].children.filter(
        (file: any) => file.path !== 'contracts/Contract.sol'
      );
      // Add a different file
      updatedFileStructure[0].children.push({
        name: 'ReplacementContract.sol',
        path: 'contracts/ReplacementContract.sol',
        type: 'file'
      });
    }
    
    vi.mocked(virtualFS.listFiles).mockResolvedValue(updatedFileStructure);
    
    // Change virtualFS to indicate selected file no longer exists
    vi.mocked(virtualFS.exists).mockImplementation(async (path: string) => {
      return path !== 'contracts/Contract.sol';
    });
    
    // Simulate reload
    await act(async () => {
      const visibilityEvent = new Event('visibilitychange');
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true
      });
      document.dispatchEvent(visibilityEvent);
    });
    
    // The new file should be visible
    await waitFor(() => {
      expect(screen.getByText('ReplacementContract.sol')).toBeInTheDocument();
    });
    
    // The old file should not be in the document anymore
    await waitFor(() => {
      const oldFileElement = screen.queryByText('Contract.sol');
      expect(oldFileElement).not.toBeInTheDocument();
    }, { timeout: 3000 });
    
    // Should have notified parent that the selected file is no longer available
    await waitFor(() => {
      expect(onFileSelectMock).toHaveBeenCalledWith(null);
    });
  });
}); 