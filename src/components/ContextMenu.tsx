import React from 'react';
import {
  TrashIcon,
  DocumentDuplicateIcon,
  ClipboardIcon,
  PencilIcon,
  FolderPlusIcon,
  DocumentPlusIcon,
} from '@heroicons/react/24/outline';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  type: 'file' | 'directory';
  path: string;
  onDelete: (path: string) => void;
  onRename: (path: string) => void;
  onCopy: (path: string) => void;
  onPaste: (targetPath: string) => void;
  onNewFile?: (path: string) => void;
  onNewFolder?: (path: string) => void;
  canPaste: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  type,
  path,
  onDelete,
  onRename,
  onCopy,
  onPaste,
  onNewFile,
  onNewFolder,
  canPaste
}) => {
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: y,
    left: x,
    zIndex: 1000,
  };

  const handleClick = (action: () => void) => {
    action();
    onClose();
  };

  const MenuItem = ({ icon: Icon, text, onClick, disabled = false }) => (
    <button
      className={`w-full px-4 py-2 text-sm text-left flex items-center space-x-2 
        ${disabled 
          ? 'text-gray-500 cursor-not-allowed' 
          : 'text-gray-300 hover:bg-gray-700'}`}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      <Icon className="w-4 h-4" />
      <span>{text}</span>
    </button>
  );

  return (
    <>
      <div
        className="fixed inset-0"
        onClick={onClose}
      />
      <div
        style={menuStyle}
        className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 overflow-hidden min-w-[200px]"
      >
        <div className="py-1">
          <MenuItem
            icon={PencilIcon}
            text="Rename"
            onClick={() => handleClick(() => onRename(path))}
          />
          <MenuItem
            icon={DocumentDuplicateIcon}
            text="Copy"
            onClick={() => handleClick(() => onCopy(path))}
          />
          <MenuItem
            icon={ClipboardIcon}
            text="Paste"
            onClick={() => handleClick(() => onPaste(path))}
            disabled={!canPaste}
          />
          <MenuItem
            icon={TrashIcon}
            text="Delete"
            onClick={() => handleClick(() => onDelete(path))}
          />

          {type === 'directory' && (
            <>
              <div className="border-t border-gray-700 my-1" />
              <MenuItem
                icon={DocumentPlusIcon}
                text="New File"
                onClick={() => handleClick(() => onNewFile?.(path))}
              />
              <MenuItem
                icon={FolderPlusIcon}
                text="New Folder"
                onClick={() => handleClick(() => onNewFolder?.(path))}
              />
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ContextMenu; 