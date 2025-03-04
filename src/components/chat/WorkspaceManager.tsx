import { useState } from 'react';
import { 
  FolderIcon, 
  PlusIcon, 
  CheckIcon,
  XMarkIcon, 
  FolderArrowDownIcon
} from '@heroicons/react/24/outline';
import { Workspace } from '../../services/conversationService';

interface WorkspaceManagerProps {
  contextId: string;
  workspaces: Workspace[];
  activeWorkspaceId?: string;
  onWorkspaceSwitch: (workspaceId: string) => void;
  onWorkspaceCreate: (name: string, description?: string) => void;
}

const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({
  workspaces,
  activeWorkspaceId,
  onWorkspaceSwitch,
  onWorkspaceCreate
}) => {
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState('');
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({});

  const handleToggleExpand = (workspaceId: string) => {
    setExpandedWorkspaces(prev => ({
      ...prev,
      [workspaceId]: !prev[workspaceId]
    }));
  };

  const handleCreateWorkspace = () => {
    if (newWorkspaceName.trim()) {
      onWorkspaceCreate(newWorkspaceName, newWorkspaceDescription || undefined);
      setNewWorkspaceName('');
      setNewWorkspaceDescription('');
      setIsCreatingWorkspace(false);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 bg-gray-800/80 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Workspaces</h3>
        <button
          onClick={() => setIsCreatingWorkspace(true)}
          className="p-1.5 bg-blue-500/20 text-blue-400 rounded-md hover:bg-blue-500/30 transition-colors"
          title="Create new workspace"
        >
          <PlusIcon className="w-5 h-5" />
        </button>
      </div>

      {isCreatingWorkspace ? (
        <div className="mb-4 space-y-3 p-3 bg-gray-700/50 rounded-lg">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Workspace Name</label>
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="Enter workspace name"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Description (optional)</label>
            <input
              type="text"
              value={newWorkspaceDescription}
              onChange={(e) => setNewWorkspaceDescription(e.target.value)}
              placeholder="Enter description"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleCreateWorkspace}
              className="px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              <CheckIcon className="w-4 h-4 inline mr-1" />
              Create
            </button>
            <button
              onClick={() => setIsCreatingWorkspace(false)}
              className="px-3 py-1.5 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              <XMarkIcon className="w-4 h-4 inline mr-1" />
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {workspaces.map((workspace) => (
          <div
            key={workspace.id}
            className={`p-3 rounded-lg transition-colors cursor-pointer ${
              workspace.id === activeWorkspaceId
                ? 'bg-blue-500/20 border border-blue-500/30'
                : 'bg-gray-700/40 border border-gray-700 hover:bg-gray-700/60'
            }`}
          >
            <div 
              className="flex items-center justify-between"
              onClick={() => onWorkspaceSwitch(workspace.id)}
            >
              <div className="flex items-center space-x-2">
                <FolderIcon className={`w-5 h-5 ${
                  workspace.id === activeWorkspaceId ? 'text-blue-400' : 'text-gray-400'
                }`} />
                <span className={`font-medium ${
                  workspace.id === activeWorkspaceId ? 'text-blue-400' : 'text-white'
                }`}>
                  {workspace.name}
                </span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-xs text-gray-400">
                  {Object.keys(workspace.files).length} files
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleExpand(workspace.id);
                  }}
                  className="p-1 text-gray-400 hover:text-white hover:bg-gray-600/50 rounded"
                >
                  <FolderArrowDownIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            {workspace.description && (
              <p className="mt-1 text-sm text-gray-400">{workspace.description}</p>
            )}
            
            <div className="mt-1 text-xs text-gray-500">
              Updated: {formatDate(workspace.updatedAt)}
            </div>

            {/* Lista de archivos expandible */}
            {expandedWorkspaces[workspace.id] && (
              <div className="mt-3 pt-2 border-t border-gray-700">
                <div className="text-sm font-medium text-gray-400 mb-2">Files:</div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {Object.entries(workspace.files).length > 0 ? (
                    Object.entries(workspace.files).map(([path, file]) => (
                      <div key={path} className="flex items-center justify-between p-1.5 rounded hover:bg-gray-700/50">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            file.language === 'solidity' ? 'bg-green-400' :
                            file.language === 'javascript' ? 'bg-yellow-400' :
                            file.language === 'typescript' ? 'bg-blue-400' :
                            'bg-gray-400'
                          }`}></div>
                          <span className="text-sm text-gray-300">{path.split('/').pop()}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(file.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 italic p-2">No files in this workspace</div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {workspaces.length === 0 && (
          <div className="text-center p-4 bg-gray-700/30 rounded-lg">
            <div className="text-gray-400">No workspaces found</div>
            <button
              onClick={() => setIsCreatingWorkspace(true)}
              className="mt-2 px-3 py-1.5 bg-blue-600/80 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              Create a Workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceManager; 