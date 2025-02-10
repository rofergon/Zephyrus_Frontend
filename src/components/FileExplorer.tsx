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
import ContextMenu from './ContextMenu';

interface FileExplorerProps {
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
}

interface FileSystemItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileSystemItem[];
}

interface DragItem {
  path: string;
  type: 'file' | 'directory';
}

interface ContextMenuState {
  show: boolean;
  x: number;
  y: number;
  type: 'file' | 'directory';
  path: string;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ onFileSelect, selectedFile }) => {
  const [files, setFiles] = useState<FileSystemItem[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<string[]>(['contracts']);
  const [showNewItemMenu, setShowNewItemMenu] = useState(false);
  const [isRenaming, setIsRenaming] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [operationSuccess, setOperationSuccess] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<DragItem | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);
  const fileExplorerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [clipboard, setClipboard] = useState<{ type: 'file' | 'directory'; path: string } | null>(null);

  // Función para mostrar mensajes de éxito temporalmente
  const showSuccess = (message: string) => {
    setOperationSuccess(message);
    setTimeout(() => setOperationSuccess(null), 3000);
  };

  // Función para comparar estructuras de archivos
  const hasFileStructureChanged = (oldFiles: FileSystemItem[], newFiles: FileSystemItem[]): boolean => {
    const stringify = (items: FileSystemItem[]) => {
      return JSON.stringify(items, (key, value) => {
        if (key === 'children' && Array.isArray(value)) {
          return value.sort((a, b) => a.path.localeCompare(b.path));
        }
        return value;
      });
    };
    return stringify(oldFiles) !== stringify(newFiles);
  };

  const loadFiles = useCallback(async () => {
    try {
      const fileList = await virtualFS.listFiles();
      
      // Verificar si hay cambios reales antes de actualizar el estado
      if (!hasFileStructureChanged(files, fileList)) {
        return;
      }

      setIsLoading(true);
      setError(null);
      
      // Mantener el estado de las carpetas expandidas
      const allPaths = new Set<string>();
      const processItem = (item: FileSystemItem) => {
        if (item.type === 'directory') {
          allPaths.add(item.path);
        }
        if (item.children) {
          item.children.forEach(processItem);
        }
      };
      fileList.forEach(processItem);

      // Mantener solo las carpetas que aún existen
      const validExpandedFolders = expandedFolders.filter(path => allPaths.has(path));

      // Asegurarse de que la carpeta contracts esté siempre expandida si existe
      if (allPaths.has('contracts') && !validExpandedFolders.includes('contracts')) {
        validExpandedFolders.push('contracts');
      }

      if (JSON.stringify(validExpandedFolders) !== JSON.stringify(expandedFolders)) {
        setExpandedFolders(validExpandedFolders);
      }

      setFiles(fileList);
    } catch (error) {
      console.error('Error loading files:', error);
      setError(error instanceof Error ? error.message : 'Error loading files');
    } finally {
      setIsLoading(false);
    }
  }, [files, expandedFolders]);

  // Efecto para la carga inicial y después de operaciones
  useEffect(() => {
    // Carga inicial
    loadFiles();

    // Suscribirse a eventos de visibilidad del documento
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadFiles();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadFiles]);

  // Función para forzar la recarga después de operaciones
  const forceReload = useCallback(async () => {
    await loadFiles();
  }, [loadFiles]);

  const handleDrop = async (e: React.DragEvent, targetPath: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItem(null);

    if (!draggedItem) return;

    try {
      setIsLoading(true);
      const sourcePath = draggedItem.path;
      const sourceFileName = sourcePath.split('/').pop();
      
      const newPath = targetPath ? `${targetPath}/${sourceFileName}` : sourceFileName;

      if (newPath === sourcePath) {
        setDraggedItem(null);
        return;
      }

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

      // Expandir la carpeta destino automáticamente
      if (targetPath && !expandedFolders.includes(targetPath)) {
        setExpandedFolders(prev => [...prev, targetPath]);
      }

      // Actualizar la selección si el archivo movido era el seleccionado
      if (selectedFile === sourcePath) {
        onFileSelect(result.newPath);
      }

      await forceReload();
      showSuccess(`${draggedItem.type === 'directory' ? 'Folder' : 'File'} moved successfully`);
    } catch (error) {
      console.error('Drop error:', error);
      setError(error instanceof Error ? error.message : 'Error moving item');
      await forceReload();
    } finally {
      setIsLoading(false);
      setDraggedItem(null);
    }
  };

  const handleNewFile = async (fileName: string) => {
    try {
      setIsLoading(true);
      const path = fileName.endsWith('.sol') ? fileName : `${fileName}.sol`;
      await virtualFS.writeFile(path, '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.19;\n\ncontract NewContract {\n    constructor() {\n    }\n}');
      await loadFiles();
      onFileSelect(path);
      showSuccess('File created successfully');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error creating file');
      await loadFiles();
    } finally {
      setIsLoading(false);
      setShowNewFileModal(false);
    }
  };

  const handleNewFolder = async (folderName: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await virtualFS.writeFile(`${folderName}/.gitkeep`, '');
      await loadFiles();
      showSuccess('Folder created successfully');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error creating folder');
    } finally {
      setIsLoading(false);
      setShowNewFolderModal(false);
    }
  };

  const handleDelete = async (path: string) => {
    try {
      setIsLoading(true);
      setError(null);
      await virtualFS.deleteFile(path);
      await loadFiles();
      showSuccess('Item deleted successfully');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error deleting item');
    } finally {
      setIsLoading(false);
      setShowDeleteModal(false);
      setItemToDelete(null);
    }
  };

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => 
      prev.includes(path) 
        ? prev.filter(p => p !== path)
        : [...prev, path]
    );
  };

  const handleContextMenu = (e: React.MouseEvent, item: FileSystemItem) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      type: item.type,
      path: item.path
    });
  };

  const handleCopy = (path: string) => {
    const item = files.find(f => f.path === path) || 
                files.flatMap(f => f.children || []).find(c => c?.path === path);
    if (item) {
      setClipboard({
        type: item.type,
        path: item.path
      });
    }
  };

  const handlePaste = async (targetPath: string) => {
    if (!clipboard) return;

    try {
      setIsLoading(true);
      const sourcePath = clipboard.path;
      const fileName = sourcePath.split('/').pop();
      const newPath = targetPath ? `${targetPath}/${fileName}` : fileName;

      if (clipboard.type === 'directory') {
        await virtualFS.moveDirectory(sourcePath, newPath, { autoRename: true });
      } else {
        await virtualFS.moveFile(sourcePath, newPath, { autoRename: true });
      }

      await forceReload();
      showSuccess('Item pasted successfully');
    } catch (error) {
      console.error('Paste error:', error);
      setError(error instanceof Error ? error.message : 'Error pasting item');
    } finally {
      setIsLoading(false);
    }
  };

  const renderTree = useCallback((items: FileSystemItem[]) => {
    return items.map((item) => {
      const isExpanded = expandedFolders.includes(item.path);
      const isSelected = selectedFile === item.path;
      const isDraggedOver = dragOverItem === item.path;
      const isBeingDragged = draggedItem?.path === item.path;

      if (item.type === 'directory') {
        return (
          <div 
            key={item.path}
            className={`select-none ${isBeingDragged ? 'opacity-50' : ''}`}
            draggable
            onContextMenu={(e) => handleContextMenu(e, item)}
            onDragStart={(e) => {
              e.stopPropagation();
              setDraggedItem({ path: item.path, type: 'directory' });
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (draggedItem && draggedItem.path !== item.path) {
                setDragOverItem(item.path);
              }
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dragOverItem === item.path) {
                setDragOverItem(null);
              }
            }}
            onDrop={(e) => handleDrop(e, item.path)}
          >
            <div
              className={`flex items-center px-2 py-1 hover:bg-gray-700/50 cursor-pointer ${
                isExpanded ? 'bg-gray-800/30' : ''
              } ${isDraggedOver ? 'bg-blue-500/20 border-2 border-blue-500/50' : ''}`}
              onClick={() => toggleFolder(item.path)}
            >
              {isExpanded ? (
                <FolderOpenIcon className="w-4 h-4 text-yellow-500 mr-2" />
              ) : (
                <FolderIcon className="w-4 h-4 text-yellow-500 mr-2" />
              )}
              <span className="text-gray-300 text-sm">{item.name}</span>
            </div>
            {isExpanded && item.children && (
              <div className="ml-4">
                {renderTree(item.children)}
              </div>
            )}
          </div>
        );
      }

      return (
        <div
          key={item.path}
          className={`flex items-center px-2 py-1 hover:bg-gray-700/50 cursor-pointer ${
            isSelected ? 'bg-blue-500/20' : ''
          } ${isDraggedOver ? 'bg-blue-500/20 border-2 border-blue-500/50' : ''} ${
            isBeingDragged ? 'opacity-50' : ''
          }`}
          draggable
          onContextMenu={(e) => handleContextMenu(e, item)}
          onDragStart={(e) => {
            e.stopPropagation();
            setDraggedItem({ path: item.path, type: 'file' });
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (draggedItem && draggedItem.path !== item.path) {
              setDragOverItem(item.path);
            }
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (dragOverItem === item.path) {
              setDragOverItem(null);
            }
          }}
          onDrop={(e) => handleDrop(e, item.path)}
          onClick={() => onFileSelect(item.path)}
        >
          <CodeBracketIcon className="w-4 h-4 text-blue-400 mr-2" />
          <span className="text-gray-300 text-sm">{item.name}</span>
        </div>
      );
    });
  }, [expandedFolders, selectedFile, draggedItem, dragOverItem, onFileSelect, handleDrop]);

  return (
    <div className="h-full bg-gray-900 border-r border-gray-700 flex flex-col" ref={fileExplorerRef}>
      <div className="p-2 border-b border-gray-700">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-300">FILE EXPLORER</span>
          <button 
            className="p-1 hover:bg-gray-700 rounded"
            onClick={() => setShowNewItemMenu(!showNewItemMenu)}
          >
            <PlusIcon className="w-4 h-4 text-gray-300" />
          </button>
        </div>

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

      <div className="flex-1 overflow-y-auto">
        {renderTree(files)}
      </div>

      {/* Modales */}
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
                const formData = new FormData(e.currentTarget);
                handleNewFile(formData.get('fileName') as string);
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

      {/* Menú de nuevo item */}
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

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          path={contextMenu.path}
          onClose={() => setContextMenu(null)}
          onDelete={(path) => {
            setItemToDelete(path);
            setShowDeleteModal(true);
          }}
          onRename={(path) => {
            setIsRenaming(path);
            const name = path.split('/').pop() || '';
            setNewName(name);
          }}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onNewFile={(path) => {
            setShowNewFileModal(true);
          }}
          onNewFolder={(path) => {
            setShowNewFolderModal(true);
          }}
          canPaste={!!clipboard}
        />
      )}
    </div>
  );
};

export default FileExplorer; 