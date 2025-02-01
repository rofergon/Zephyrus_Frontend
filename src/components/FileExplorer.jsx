import React, { useState, useEffect, useCallback } from 'react';
import { 
  FolderIcon, 
  DocumentIcon, 
  PlusIcon, 
  TrashIcon,
  PencilIcon,
  FolderPlusIcon,
  DocumentPlusIcon,
  FolderOpenIcon
} from '@heroicons/react/24/outline';
import { virtualFS } from '../services/virtual-fs';

const FileExplorer = ({ onFileSelect, selectedFile }) => {
  const [files, setFiles] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(['contracts', 'contracts/@openzeppelin', 'contracts/@openzeppelin/contracts']);
  const [showNewItemMenu, setShowNewItemMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(null);
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadFiles();
    
    // Set up polling to check for new files every 2 seconds
    const interval = setInterval(loadFiles, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const loadFiles = async () => {
    try {
      const structure = await virtualFS.listFiles();
      setFiles(structure || []);
      
      // Expand parent folders of the selected file if any
      if (selectedFile) {
        const parts = selectedFile.split('/');
        let path = '';
        for (const part of parts.slice(0, -1)) {
          path = path ? `${path}/${part}` : part;
          if (!expandedFolders.includes(path)) {
            setExpandedFolders(prev => [...prev, path]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const toggleFolder = (path) => {
    setExpandedFolders(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  const handleNewFile = async () => {
    try {
      const fileName = prompt('Enter file name:');
      if (!fileName) return;
      
      const path = fileName.endsWith('.sol') ? fileName : `${fileName}.sol`;
      await virtualFS.writeFile(path, '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.19;\n\ncontract NewContract {\n    constructor() {\n    }\n}');
      await loadFiles();
      onFileSelect(path);
    } catch (error) {
      console.error('Error creating file:', error);
      alert('Error creating file: ' + error.message);
    }
  };

  const handleNewFolder = async () => {
    try {
      const folderName = prompt('Enter folder name:');
      if (!folderName) return;
      
      // En el sistema de archivos virtual, las carpetas se crean implícitamente
      // cuando se crean archivos dentro de ellas
      await virtualFS.writeFile(`${folderName}/.gitkeep`, '');
      await loadFiles();
    } catch (error) {
      console.error('Error creating folder:', error);
      alert('Error creating folder: ' + error.message);
    }
  };

  const handleDelete = async (path) => {
    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        await virtualFS.delete(path);
        await loadFiles();
      } catch (error) {
        console.error('Error deleting item:', error);
      }
    }
  };

  const startRenaming = (path, currentName) => {
    setIsRenaming(path);
    setNewName(currentName);
  };

  const handleRename = async (path) => {
    try {
      await virtualFS.rename(path, newName);
      await loadFiles();
      setIsRenaming(null);
      setNewName('');
    } catch (error) {
      console.error('Error renaming item:', error);
    }
  };

  const handleFileClick = (path, item) => {
    if (item.type === 'file' && onFileSelect) {
      onFileSelect(path);
    }
  };

  const renderTree = useCallback((items, path = '') => {
    return items.map((item) => {
      const currentPath = path ? `${path}/${item.name}` : item.name;
      const isSelected = selectedFile === currentPath;
      
      if (item.type === 'directory') {
        const isExpanded = expandedFolders.includes(currentPath);
        return (
          <div key={item.path}>
            <div
              className={`flex items-center px-2 py-1 hover:bg-gray-700/50 cursor-pointer group ${
                isExpanded ? 'bg-gray-800/30' : ''
              }`}
            >
              <div className="flex-1 flex items-center" onClick={() => toggleFolder(currentPath)}>
                {isExpanded ? (
                  <FolderOpenIcon className="w-4 h-4 text-yellow-500 mr-2" />
                ) : (
                  <FolderIcon className="w-4 h-4 text-yellow-500 mr-2" />
                )}
                {isRenaming === currentPath ? (
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onBlur={() => handleRename(currentPath)}
                    onKeyPress={(e) => e.key === 'Enter' && handleRename(currentPath)}
                    className="bg-gray-800 text-gray-300 text-sm px-1 rounded"
                    autoFocus
                  />
                ) : (
                  <span className="text-gray-300 text-sm">{item.name}</span>
                )}
              </div>
              <div className="hidden group-hover:flex items-center space-x-2">
                <button onClick={() => startRenaming(currentPath, item.name)} className="p-1 hover:bg-gray-600 rounded">
                  <PencilIcon className="w-4 h-4 text-gray-400" />
                </button>
                <button onClick={() => handleDelete(currentPath)} className="p-1 hover:bg-gray-600 rounded">
                  <TrashIcon className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            </div>
            {isExpanded && item.children && (
              <div className="ml-4">
                {renderTree(item.children, currentPath)}
              </div>
            )}
          </div>
        );
      } else {
        return (
          <div
            key={item.path}
            className={`flex items-center px-2 py-1 hover:bg-gray-700/50 cursor-pointer group ${
              isSelected ? 'bg-blue-500/20' : ''
            }`}
            onClick={() => handleFileClick(currentPath, item)}
          >
            <div className="flex-1 flex items-center">
              <DocumentIcon className="w-4 h-4 text-blue-400 mr-2" />
              {isRenaming === currentPath ? (
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={() => handleRename(currentPath)}
                  onKeyPress={(e) => e.key === 'Enter' && handleRename(currentPath)}
                  className="bg-gray-800 text-gray-300 text-sm px-1 rounded"
                  autoFocus
                />
              ) : (
                <span className="text-gray-300 text-sm">{item.name}</span>
              )}
            </div>
            <div className="hidden group-hover:flex items-center space-x-2">
              <button onClick={() => startRenaming(currentPath, item.name)} className="p-1 hover:bg-gray-600 rounded">
                <PencilIcon className="w-4 h-4 text-gray-400" />
              </button>
              <button onClick={() => handleDelete(currentPath)} className="p-1 hover:bg-gray-600 rounded">
                <TrashIcon className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        );
      }
    });
  }, [expandedFolders, isRenaming, newName, selectedFile, onFileSelect, handleFileClick, handleDelete, handleRename, toggleFolder]);

  return (
    <div className="h-full bg-gray-900 border-r border-gray-700 flex flex-col">
      <div className="p-2 border-b border-gray-700 flex justify-between items-center">
        <span className="text-sm font-medium text-gray-300">FILE EXPLORER</span>
        <div className="relative">
          <button 
            className="p-1 hover:bg-gray-700 rounded"
            onClick={() => setShowNewItemMenu(!showNewItemMenu)}
          >
            <PlusIcon className="w-4 h-4 text-gray-300" />
          </button>
          {showNewItemMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
              <div className="py-1">
                <button
                  className="w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
                  onClick={handleNewFile}
                >
                  <DocumentPlusIcon className="w-4 h-4 mr-2" />
                  New File
                </button>
                <button
                  className="w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
                  onClick={handleNewFolder}
                >
                  <FolderPlusIcon className="w-4 h-4 mr-2" />
                  New Folder
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {renderTree(files)}
      </div>
    </div>
  );
};

export default FileExplorer; 