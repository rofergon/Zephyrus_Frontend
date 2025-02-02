import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  FolderIcon, 
  DocumentIcon, 
  PlusIcon, 
  TrashIcon,
  PencilIcon,
  FolderPlusIcon,
  DocumentPlusIcon,
  FolderOpenIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  PhotoIcon
} from '@heroicons/react/24/outline';
import { virtualFS } from '../services/virtual-fs';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { Tooltip } from 'react-tooltip';

const FileExplorer = ({ onFileSelect, selectedFile }) => {
  const [files, setFiles] = useState([]);
  const [expandedFolders, setExpandedFolders] = useState(['contracts', 'contracts/@openzeppelin', 'contracts/@openzeppelin/contracts']);
  const [showNewItemMenu, setShowNewItemMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState(null);
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [operationSuccess, setOperationSuccess] = useState(null);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [currentPath, setCurrentPath] = useState('');
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const fileExplorerRef = useRef(null);

  // Función para mostrar mensajes de éxito temporalmente
  const showSuccess = (message) => {
    setOperationSuccess(message);
    setTimeout(() => setOperationSuccess(null), 3000);
  };

  useEffect(() => {
    loadFiles();
    const interval = setInterval(loadFiles, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Add keyboard shortcut listeners
    const handleKeyDown = (e) => {
      if (!fileExplorerRef.current?.contains(document.activeElement)) return;

      if (e.key === 'Delete' && selectedFile) {
        e.preventDefault();
        setItemToDelete(selectedFile);
        setShowDeleteModal(true);
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'n':
            e.preventDefault();
            setShowNewFileModal(true);
            break;
          case 'shift+n':
            e.preventDefault();
            setShowNewFolderModal(true);
            break;
          case 'f':
            e.preventDefault();
            document.querySelector('input[placeholder="Search files..."]')?.focus();
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile]);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const structure = await virtualFS.listFiles();
      setFiles(structure || []);
      
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
      setError('Error loading files: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para obtener el icono según el tipo de archivo
  const getFileIcon = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
      case 'sol':
        return <CodeBracketIcon className="w-4 h-4 text-green-400" />;
      case 'js':
      case 'jsx':
        return <DocumentTextIcon className="w-4 h-4 text-yellow-400" />;
      case 'json':
        return <CodeBracketIcon className="w-4 h-4 text-blue-400" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        return <PhotoIcon className="w-4 h-4 text-pink-400" />;
      default:
        return <DocumentIcon className="w-4 h-4 text-blue-400" />;
    }
  };

  const toggleFolder = (path) => {
    setExpandedFolders(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  const handleNewFile = async (fileName) => {
    try {
      setIsLoading(true);
      setError(null);
      const path = fileName.endsWith('.sol') ? fileName : `${fileName}.sol`;
      await virtualFS.writeFile(path, '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.19;\n\ncontract NewContract {\n    constructor() {\n    }\n}');
      await loadFiles();
      onFileSelect(path);
      showSuccess('File created successfully');
    } catch (error) {
      setError('Error creating file: ' + error.message);
    } finally {
      setIsLoading(false);
      setShowNewFileModal(false);
    }
  };

  const handleNewFolder = async (folderName) => {
    try {
      setIsLoading(true);
      setError(null);
      await virtualFS.writeFile(`${folderName}/.gitkeep`, '');
      await loadFiles();
      showSuccess('Folder created successfully');
    } catch (error) {
      setError('Error creating folder: ' + error.message);
    } finally {
      setIsLoading(false);
      setShowNewFolderModal(false);
    }
  };

  const handleDelete = async (path) => {
      try {
      setIsLoading(true);
      setError(null);
        await virtualFS.delete(path);
        await loadFiles();
      showSuccess('Item deleted successfully');
      } catch (error) {
      setError('Error deleting item: ' + error.message);
    } finally {
      setIsLoading(false);
      setShowDeleteModal(false);
      setItemToDelete(null);
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

  const getParentPath = (path) => {
    const parts = path.split('/');
    return parts.slice(0, -1).join('/');
  };

  const handleDragStart = (e, path, type) => {
    e.stopPropagation();
    setDraggedItem({ path, type });
    e.dataTransfer.setData('text/plain', path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, path) => {
    e.preventDefault();
    e.stopPropagation();
    // No permitir soltar sobre el mismo elemento
    if (draggedItem && draggedItem.path === path) {
      return;
    }
    setDragOverItem(path);
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItem(null);
  };

  const handleDrop = async (e, targetPath) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItem(null);

    if (!draggedItem) return;

    try {
      setIsLoading(true);
      const sourcePath = draggedItem.path;
      const sourceFileName = sourcePath.split('/').pop();
      
      // Si estamos soltando en el área general (root) o en una carpeta
      const newPath = targetPath ? `${targetPath}/${sourceFileName}` : sourceFileName;

      // No hacer nada si la ruta nueva es igual a la actual
      if (newPath === sourcePath) {
        setDraggedItem(null);
        return;
      }

      // No permitir soltar un elemento sobre sí mismo o sobre su propio subdirectorio
      if (targetPath && (
        draggedItem.path === targetPath || 
        targetPath.startsWith(draggedItem.path + '/')
      )) {
        setDraggedItem(null);
        return;
      }

      let result;
      if (draggedItem.type === 'directory') {
        result = await virtualFS.moveDirectory(sourcePath, newPath, {
          autoRename: true
        });
      } else {
        result = await virtualFS.moveFile(sourcePath, newPath, {
          autoRename: true
        });
      }

      // Si el archivo fue renombrado, mostrar el modal
      if (result.renamed) {
        setDuplicateInfo({
          oldPath: sourcePath,
          newPath: result.newPath,
          type: draggedItem.type
        });
        setShowDuplicateModal(true);
      }

      // Recargar la estructura de archivos
      await loadFiles();

      // Actualizar la selección si el archivo movido era el seleccionado
      if (selectedFile === sourcePath) {
        onFileSelect(result.newPath);
      }
      
      showSuccess(`${draggedItem.type === 'directory' ? 'Folder' : 'File'} moved to ${targetPath ? targetPath : 'root directory'}`);
    } catch (error) {
      console.error('Drop error:', error);
      setError('Error moving item: ' + error.message);
    } finally {
      setIsLoading(false);
      setDraggedItem(null);
    }
  };

  // Función auxiliar para encontrar un directorio en la estructura
  const findDirectory = (items, path) => {
    const parts = path.split('/');
    let current = null;
    
    const findRecursive = (items, depth = 0) => {
      for (const item of items) {
        const currentPath = parts.slice(0, depth + 1).join('/');
        if (item.path === path) {
          return item;
        }
        if (item.type === 'directory' && item.path === currentPath && item.children) {
          const found = findRecursive(item.children, depth + 1);
          if (found) return found;
        }
      }
      return null;
    };

    return findRecursive(items);
  };

  const renderTree = useCallback((items, path = '') => {
    return items.map((item) => {
      const currentPath = path ? `${path}/${item.name}` : item.name;
      const isSelected = selectedFile === currentPath;
      const isDraggedOver = dragOverItem === currentPath;
      const isBeingDragged = draggedItem?.path === currentPath;
      
      if (item.type === 'directory') {
        const isExpanded = expandedFolders.includes(currentPath);
        return (
          <div 
            key={currentPath}
            draggable
            onDragStart={(e) => handleDragStart(e, currentPath, 'directory')}
            onDragOver={(e) => handleDragOver(e, currentPath)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, currentPath)}
            className={`${isBeingDragged ? 'opacity-50' : ''} relative`}
          >
            <div
              className={`flex items-center px-2 py-1 hover:bg-gray-700/50 cursor-pointer group ${
                isExpanded ? 'bg-gray-800/30' : ''
              } ${isDraggedOver ? 'bg-blue-500/20 border-2 border-blue-500/50' : ''}`}
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
            key={currentPath}
            draggable
            onDragStart={(e) => handleDragStart(e, currentPath, 'file')}
            onDragOver={(e) => handleDragOver(e, currentPath)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, currentPath)}
            className={`flex items-center px-2 py-1 hover:bg-gray-700/50 cursor-pointer group ${
              isSelected ? 'bg-blue-500/20' : ''
            } ${isDraggedOver ? 'bg-blue-500/20 border-2 border-blue-500/50' : ''} ${
              isBeingDragged ? 'opacity-50' : ''
            }`}
            onClick={() => handleFileClick(currentPath, item)}
          >
            <div className="flex-1 flex items-center">
              {getFileIcon(item.name)}
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
  }, [expandedFolders, isRenaming, newName, selectedFile, dragOverItem, draggedItem]);

  return (
    <div 
      className="h-full bg-gray-900 border-r border-gray-700 flex flex-col"
      ref={fileExplorerRef}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Solo mostrar el indicador de root si no estamos sobre una carpeta
        if (!dragOverItem) {
          setDragOverItem('');
        }
        e.dataTransfer.dropEffect = 'move';
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Solo limpiar el dragOverItem si el cursor sale completamente del explorador
        const rect = e.currentTarget.getBoundingClientRect();
        if (
          e.clientX <= rect.left ||
          e.clientX >= rect.right ||
          e.clientY <= rect.top ||
          e.clientY >= rect.bottom
        ) {
          setDragOverItem(null);
        }
      }}
      onDrop={(e) => handleDrop(e, '')}
    >
      <div className="p-2 border-b border-gray-700 space-y-2">
        <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-gray-300">FILE EXPLORER</span>
        <div className="relative">
          <button 
            className="p-1 hover:bg-gray-700 rounded"
            onClick={() => setShowNewItemMenu(!showNewItemMenu)}
              data-tooltip-id="new-item-tooltip"
              data-tooltip-content="Create new item"
          >
            <PlusIcon className="w-4 h-4 text-gray-300" />
          </button>
            <Tooltip id="new-item-tooltip" />
          {showNewItemMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-gray-800 ring-1 ring-black ring-opacity-5 z-50">
              <div className="py-1">
                <button
                  className="w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
                    onClick={() => {
                      setShowNewFileModal(true);
                      setShowNewItemMenu(false);
                    }}
                >
                  <DocumentPlusIcon className="w-4 h-4 mr-2" />
                  New File
                </button>
                <button
                  className="w-full px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
                    onClick={() => {
                      setShowNewFolderModal(true);
                      setShowNewItemMenu(false);
                    }}
                >
                  <FolderPlusIcon className="w-4 h-4 mr-2" />
                  New Folder
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
        
        {/* Search bar */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search files..."
            className="w-full bg-gray-800 text-gray-300 text-sm rounded px-8 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <MagnifyingGlassIcon className="w-4 h-4 text-gray-400 absolute left-2 top-1/2 transform -translate-y-1/2" />
        </div>
      </div>

      {/* Loading and error states */}
      {isLoading && (
        <div className="p-4 text-center text-gray-400">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mx-auto"></div>
        </div>
      )}
      
      {error && (
        <div className="p-2 m-2 bg-red-900/50 text-red-200 text-sm rounded">
          {error}
        </div>
      )}

      {operationSuccess && (
        <div className="p-2 m-2 bg-green-900/50 text-green-200 text-sm rounded">
          {operationSuccess}
        </div>
      )}

      <div className="flex-1 overflow-y-auto relative">
        {/* Breadcrumb navigation */}
        {currentPath && (
          <div className="px-2 py-1 text-sm text-gray-400 border-b border-gray-700 flex items-center">
            <button 
              onClick={() => setCurrentPath(getParentPath(currentPath))}
              className="hover:text-gray-300"
            >
              ..
            </button>
            <span className="mx-1">/</span>
            <span>{currentPath}</span>
          </div>
        )}

        {/* Drop zone indicator when dragging */}
        {draggedItem && dragOverItem === '' && (
          <div className="absolute inset-0 border-2 border-blue-500/50 bg-blue-500/20 pointer-events-none z-10">
            <div className="flex items-center justify-center h-full text-blue-200">
              Drop here to move to root directory
            </div>
          </div>
        )}

        {renderTree(files.filter(item => 
          !searchQuery || 
          item.name.toLowerCase().includes(searchQuery.toLowerCase())
        ))}
      </div>

      {/* Delete confirmation modal */}
      <Transition show={showDeleteModal} as={Fragment}>
        <Dialog onClose={() => setShowDeleteModal(false)} className="relative z-50">
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="bg-gray-800 rounded-lg p-6 max-w-sm">
              <Dialog.Title className="text-lg font-medium text-gray-200">
                Confirm Delete
              </Dialog.Title>
              <Dialog.Description className="mt-2 text-gray-400">
                Are you sure you want to delete {itemToDelete}? This action cannot be undone.
              </Dialog.Description>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  className="px-4 py-2 text-sm text-gray-400 hover:text-gray-300"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                  onClick={() => handleDelete(itemToDelete)}
                >
                  Delete
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      {/* New File Modal */}
      <Transition show={showNewFileModal} as={Fragment}>
        <Dialog onClose={() => setShowNewFileModal(false)} className="relative z-50">
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
              <Dialog.Title className="text-lg font-medium text-gray-200">
                Create New File
              </Dialog.Title>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleNewFile(e.target.fileName.value);
              }}>
                <input
                  type="text"
                  name="fileName"
                  placeholder="Enter file name"
                  className="mt-4 w-full bg-gray-700 text-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <div className="mt-4 flex justify-end space-x-2">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm text-gray-400 hover:text-gray-300"
                    onClick={() => setShowNewFileModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Create
                  </button>
                </div>
              </form>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      {/* New Folder Modal */}
      <Transition show={showNewFolderModal} as={Fragment}>
        <Dialog onClose={() => setShowNewFolderModal(false)} className="relative z-50">
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
              <Dialog.Title className="text-lg font-medium text-gray-200">
                Create New Folder
              </Dialog.Title>
              <form onSubmit={(e) => {
                e.preventDefault();
                handleNewFolder(e.target.folderName.value);
              }}>
                <input
                  type="text"
                  name="folderName"
                  placeholder="Enter folder name"
                  className="mt-4 w-full bg-gray-700 text-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
                <div className="mt-4 flex justify-end space-x-2">
                  <button
                    type="button"
                    className="px-4 py-2 text-sm text-gray-400 hover:text-gray-300"
                    onClick={() => setShowNewFolderModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Create
                  </button>
                </div>
              </form>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      {/* Duplicate File Modal */}
      <Transition show={showDuplicateModal} as={Fragment}>
        <Dialog onClose={() => setShowDuplicateModal(false)} className="relative z-50">
          <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <Dialog.Panel className="bg-gray-800 rounded-lg p-6 max-w-sm w-full">
              <Dialog.Title className="text-lg font-medium text-gray-200">
                File Name Conflict
              </Dialog.Title>
              <div className="mt-4 text-gray-300">
                <p>A {duplicateInfo?.type} with the same name already exists in the destination folder.</p>
                <p className="mt-2">The {duplicateInfo?.type} has been automatically renamed to:</p>
                <p className="mt-2 text-blue-400 font-mono text-sm">
                  {duplicateInfo?.newPath.split('/').pop()}
                </p>
              </div>
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={() => {
                    setShowDuplicateModal(false);
                    startRenaming(duplicateInfo?.newPath, duplicateInfo?.newPath.split('/').pop());
                  }}
                >
                  Rename
                </button>
                <button
                  className="px-4 py-2 text-sm text-gray-400 hover:text-gray-300"
                  onClick={() => setShowDuplicateModal(false)}
                >
                  Keep Both
                </button>
              </div>
            </Dialog.Panel>
          </div>
        </Dialog>
      </Transition>

      {/* Keyboard shortcuts help */}
      <div className="p-2 border-t border-gray-700 text-xs text-gray-500">
        <div className="flex justify-between">
          <span>New File</span>
          <span>Ctrl+N</span>
        </div>
        <div className="flex justify-between">
          <span>New Folder</span>
          <span>Ctrl+Shift+N</span>
        </div>
        <div className="flex justify-between">
          <span>Search</span>
          <span>Ctrl+F</span>
        </div>
        <div className="flex justify-between">
          <span>Delete</span>
          <span>Del</span>
        </div>
      </div>
    </div>
  );
};

export default FileExplorer; 