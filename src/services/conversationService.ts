export interface VirtualFile {
  content: string;
  language: string;
  timestamp: number;
}

export interface Workspace {
  id: string;
  name: string;
  description?: string;
  files: { [path: string]: VirtualFile };
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  timestamp: number;
  isTyping?: boolean;
  showAnimation?: boolean;
  noCompile?: boolean;
}

export interface ConversationContext {
  id: string;
  name: string;
  messages: Message[];
  virtualFiles: { [path: string]: VirtualFile };
  workspaces: { [id: string]: Workspace };
  activeWorkspace?: string;
  currentFile?: string;
  contractAddress?: string;
  contractName?: string;
  contractAbi?: any;
  active?: boolean;
  createdAt: string;
}

export class ConversationService {
  private contexts: ConversationContext[] = [];
  private activeContextId: string | null = null;
  private storageKey = 'zephyrus_conversation_contexts';

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const storedContexts = localStorage.getItem(this.storageKey);
      if (storedContexts) {
        this.contexts = JSON.parse(storedContexts);
      }
    } catch (error) {
      console.error('[ConversationService] Error loading from storage:', error);
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.contexts));
    } catch (error) {
      console.error('[ConversationService] Error saving to storage:', error);
    }
  }

  public async initializeSession(chatId: string): Promise<void> {
    this.activeContextId = chatId;
    console.log('[ConversationService] Session initialized with chatId:', chatId);
  }

  public setContexts(contexts: ConversationContext[]): void {
    this.contexts = contexts;
    this.saveToStorage();
  }

  public getContexts(): ConversationContext[] {
    return this.contexts;
  }

  public getActiveContext(): ConversationContext | undefined {
    if (!this.activeContextId) return undefined;
    return this.contexts.find(ctx => ctx.id === this.activeContextId);
  }

  public setActiveContext(contextId: string): void {
    this.activeContextId = contextId;
    this.contexts = this.contexts.map(ctx => ({
      ...ctx,
      active: ctx.id === contextId
    }));
    this.saveToStorage();
  }

  public addContext(context: ConversationContext): void {
    // Desactivar todos los contextos existentes
    this.contexts = this.contexts.map(ctx => ({
      ...ctx,
      active: false
    }));
    
    // Asegurarse de que el nuevo contexto tenga todos los campos necesarios
    const newContext = {
      ...context,
      messages: context.messages || [],
      virtualFiles: context.virtualFiles || {},
      workspaces: context.workspaces || {},
      active: true
    };
    
    this.contexts.push(newContext);
    this.activeContextId = newContext.id;
    
    console.log('[ConversationService] Context added:', newContext);
  }

  public switchContext(contextId: string): void {
    this.contexts = this.contexts.map(ctx => ({
      ...ctx,
      active: ctx.id === contextId
    }));
    this.activeContextId = contextId;
    console.log('[ConversationService] Switched to context:', contextId);
  }

  public addMessage(contextId: string, message: Message): boolean {
    const contextIndex = this.contexts.findIndex(ctx => ctx.id === contextId);
    if (contextIndex === -1) return false;

    // Add message to context in an immutable way
    const updatedContext = {
      ...this.contexts[contextIndex],
      messages: [...this.contexts[contextIndex].messages, message]
    };

    this.contexts = [
      ...this.contexts.slice(0, contextIndex),
      updatedContext,
      ...this.contexts.slice(contextIndex + 1)
    ];

    this.saveToStorage();
    return true;
  }

  public updateContext(id: string, p0: { name: string; active: boolean; virtualFiles: { [path: string]: { content: string; language: string; timestamp: number; }; }; workspaces: { [id: string]: { id: string; name: string; description?: string; files: { [path: string]: { content: string; language: string; timestamp: number; }; }; createdAt: number; updatedAt: number; }; }; }, context: ConversationContext): void {
    const index = this.contexts.findIndex(ctx => ctx.id === context.id);
    if (index !== -1) {
      this.contexts[index] = context;
      console.log('[ConversationService] Context updated:', context.id);
    }
  }

  private subscribers: ((contexts: ConversationContext[]) => void)[] = [];


  public subscribe(callback: (contexts: ConversationContext[]) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  async createNewContext(nameOrContext: string | ConversationContext, customId?: string): Promise<ConversationContext> {
    let newContext: ConversationContext;
    
    if (typeof nameOrContext === 'string') {
      // We'll only use customId for the ID, not generate one
      if (!customId) {
        console.warn('[ConversationService] No custom ID provided for new context. Using existing or generated ID.');
      }
      
      newContext = {
        id: customId || '', // Will be filled later if empty
        name: nameOrContext,
        messages: [],
        virtualFiles: {},
        workspaces: {},
        active: true,
        createdAt: new Date().toISOString()
      };
      
      // Create a default workspace, but use the ID from chatService if available
      const workspaceId = `ws_${Date.now()}`; // Simple timestamp-based ID for workspace
      
      const defaultWorkspace: Workspace = {
        id: workspaceId,
        name: 'Default Workspace',
        description: 'Default workspace for this conversation',
        files: {},
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      newContext.workspaces[defaultWorkspace.id] = defaultWorkspace;
      newContext.activeWorkspace = defaultWorkspace.id;
    } else {
      // If we're creating from an existing context object, ALWAYS preserve its ID
      newContext = {
        ...nameOrContext,
        messages: nameOrContext.messages || [],
        virtualFiles: nameOrContext.virtualFiles || {},
        workspaces: nameOrContext.workspaces || {},
        id: nameOrContext.id || customId || '' // Prefer context ID, then custom ID
      };
      
      // Create a default workspace if doesn't exist
      if (Object.keys(newContext.workspaces || {}).length === 0) {
        const workspaceId = `ws_${Date.now()}`;
        
        const defaultWorkspace: Workspace = {
          id: workspaceId,
          name: 'Default Workspace',
          description: 'Default workspace for this conversation',
          files: {},
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        
        if (!newContext.workspaces) {
          newContext.workspaces = {};
        }
        
        newContext.workspaces[defaultWorkspace.id] = defaultWorkspace;
        newContext.activeWorkspace = defaultWorkspace.id;
      }
    }
    
    // Ensure we have a valid ID - this should only happen if both nameOrContext.id and customId are empty
    if (!newContext.id) {
      console.warn('[ConversationService] Context has no ID, using current time as fallback.');
      newContext.id = `fallback_${Date.now()}`;
    }
    
    // Check if a context with this ID already exists
    const existingIdIndex = this.contexts.findIndex(ctx => ctx.id === newContext.id);
    
    if (existingIdIndex >= 0) {
      console.warn(`[ConversationService] Context with ID ${newContext.id} already exists, updating it instead of creating new.`);
      
      // If the ID appears to be a UUID, update the existing context
      if (newContext.id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)) {
        console.log(`[ConversationService] Updating existing context with ID: ${newContext.id}`);
        
        // Merge the new context with the existing one, preserving messages if needed
        const existingContext = this.contexts[existingIdIndex];
        
        // Use existing messages if the new context doesn't have any
        if (newContext.messages.length === 0 && existingContext.messages.length > 0) {
          console.log(`[ConversationService] Preserving existing messages for context: ${newContext.id}`);
          newContext.messages = existingContext.messages;
        }
        
        // Preserve virtual files if they exist
        if (Object.keys(newContext.virtualFiles || {}).length === 0 && 
            Object.keys(existingContext.virtualFiles || {}).length > 0) {
          newContext.virtualFiles = existingContext.virtualFiles;
        }
        
        // Update the existing context
        this.contexts[existingIdIndex] = {
          ...newContext,
          active: true
        };
        
        // Set all other contexts as inactive
        for (let i = 0; i < this.contexts.length; i++) {
          if (i !== existingIdIndex) {
            this.contexts[i].active = false;
          }
        }
        
        this.activeContextId = newContext.id;
        this.saveToStorage();
        
        console.log(`[ConversationService] Updated existing context: ${newContext.id}`);
        return this.contexts[existingIdIndex];
      }
    }
    
    // Set all existing contexts to inactive
    this.contexts = this.contexts.map(ctx => ({ ...ctx, active: false }));
    
    // Add the new context
    this.contexts.push(newContext);
    this.activeContextId = newContext.id;
    this.saveToStorage();
    
    console.log(`[ConversationService] Created new context: ${newContext.id}, total contexts: ${this.contexts.length}`);
    return newContext;
  }

  // Workspace management functions
  createWorkspace(contextId: string, name: string, description?: string): Workspace | null {
    const contextIndex = this.contexts.findIndex(ctx => ctx.id === contextId);
    if (contextIndex === -1) return null;

    const newWorkspace: Workspace = {
      id: `ws_${Date.now()}`,
      name,
      description,
      files: {},
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Add workspace to context
    const updatedContext = {
      ...this.contexts[contextIndex],
      workspaces: {
        ...this.contexts[contextIndex].workspaces,
        [newWorkspace.id]: newWorkspace
      },
      activeWorkspace: newWorkspace.id // Set as active workspace
    };

    this.contexts = [
      ...this.contexts.slice(0, contextIndex),
      updatedContext,
      ...this.contexts.slice(contextIndex + 1)
    ];

    this.saveToStorage();
    return newWorkspace;
  }

  getWorkspaces(contextId: string): Workspace[] {
    const context = this.contexts.find(ctx => ctx.id === contextId);
    if (!context) return [];
    return Object.values(context.workspaces);
  }

  getActiveWorkspace(contextId: string): Workspace | null {
    const context = this.contexts.find(ctx => ctx.id === contextId);
    if (!context || !context.activeWorkspace) return null;
    return context.workspaces[context.activeWorkspace] || null;
  }

  setActiveWorkspace(contextId: string, workspaceId: string): boolean {
    const contextIndex = this.contexts.findIndex(ctx => ctx.id === contextId);
    if (contextIndex === -1) return false;
    
    const context = this.contexts[contextIndex];
    if (!context.workspaces[workspaceId]) return false;

    // Update active workspace
    const updatedContext = {
      ...context,
      activeWorkspace: workspaceId
    };

    this.contexts = [
      ...this.contexts.slice(0, contextIndex),
      updatedContext,
      ...this.contexts.slice(contextIndex + 1)
    ];

    this.saveToStorage();
    return true;
  }

  // File management within workspaces
  addFileToWorkspace(
    contextId: string, 
    workspaceId: string, 
    path: string, 
    content: string, 
    language: string
  ): boolean {
    const contextIndex = this.contexts.findIndex(ctx => ctx.id === contextId);
    if (contextIndex === -1) return false;
    
    const context = this.contexts[contextIndex];
    if (!context.workspaces[workspaceId]) return false;

    const file: VirtualFile = {
      content,
      language,
      timestamp: Date.now()
    };

    // Add file to workspace
    const updatedWorkspace = {
      ...context.workspaces[workspaceId],
      files: {
        ...context.workspaces[workspaceId].files,
        [path]: file
      },
      updatedAt: Date.now()
    };

    // Also add to virtualFiles for backward compatibility
    const updatedContext = {
      ...context,
      workspaces: {
        ...context.workspaces,
        [workspaceId]: updatedWorkspace
      },
      virtualFiles: {
        ...context.virtualFiles,
        [path]: file
      }
    };

    this.contexts = [
      ...this.contexts.slice(0, contextIndex),
      updatedContext,
      ...this.contexts.slice(contextIndex + 1)
    ];

    this.saveToStorage();
    return true;
  }

  removeFileFromWorkspace(contextId: string, workspaceId: string, path: string): boolean {
    const contextIndex = this.contexts.findIndex(ctx => ctx.id === contextId);
    if (contextIndex === -1) return false;
    
    const context = this.contexts[contextIndex];
    if (!context.workspaces[workspaceId]) return false;

    // Create a copy of files without the specified path
    const { [path]: removed, ...remainingFiles } = context.workspaces[workspaceId].files;
    
    // If file doesn't exist, return false
    if (!removed) return false;

    // Also remove from virtualFiles for backward compatibility
    const { [path]: removedVirtual, ...remainingVirtualFiles } = context.virtualFiles;

    // Update workspace with files removed
    const updatedWorkspace = {
      ...context.workspaces[workspaceId],
      files: remainingFiles,
      updatedAt: Date.now()
    };

    const updatedContext = {
      ...context,
      workspaces: {
        ...context.workspaces,
        [workspaceId]: updatedWorkspace
      },
      virtualFiles: remainingVirtualFiles
    };

    this.contexts = [
      ...this.contexts.slice(0, contextIndex),
      updatedContext,
      ...this.contexts.slice(contextIndex + 1)
    ];

    this.saveToStorage();
    return true;
  }

  // Nuevos métodos para limpiar contextos
  public clearContexts(): void {
    console.log('[ConversationService] Clearing all contexts');
    this.contexts = [];
    this.activeContextId = null;
    this.saveToStorage();
  }
}

export const conversationService = new ConversationService(); 