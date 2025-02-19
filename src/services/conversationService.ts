
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: number;
  copied?: boolean;
}

export interface ConversationContext {
  id: string;
  name: string;
  type: string;
  wallet_address: string;
  created_at: string;
  last_accessed: string;
  messages: Message[];
  active?: boolean;
  virtualFiles?: {
    [path: string]: {
      content: string;
      language: string;
      timestamp: number;
    }
  };
}

export class ConversationService {
  private contexts: ConversationContext[] = [];
  private activeContextId: string | null = null;

  public async initializeSession(chatId: string): Promise<void> {
    this.activeContextId = chatId;
    console.log('[ConversationService] Session initialized with chatId:', chatId);
  }

  public setContexts(contexts: ConversationContext[]): void {
    // Asegurarse de que todos los campos necesarios estén presentes
    this.contexts = contexts.map(ctx => ({
      ...ctx,
      messages: ctx.messages || [],
      type: ctx.type || 'chat',
      active: ctx.active || false
    }));

    // Si hay contextos y no hay un contexto activo, establecer el último como activo
    if (this.contexts.length > 0 && !this.activeContextId) {
      const activeContext = this.contexts.find(ctx => ctx.active) || this.contexts[this.contexts.length - 1];
      this.activeContextId = activeContext.id;
      
      // Asegurarse de que solo un contexto esté activo
      this.contexts = this.contexts.map(ctx => ({
        ...ctx,
        active: ctx.id === this.activeContextId
      }));
    }

    console.log('[ConversationService] Contexts set:', this.contexts);
    console.log('[ConversationService] Active context ID:', this.activeContextId);
  }

  public getContexts(): ConversationContext[] {
    return this.contexts.map(ctx => ({
      ...ctx,
      active: ctx.id === this.activeContextId
    }));
  }

  public getActiveContext(): ConversationContext | undefined {
    const context = this.contexts.find(ctx => ctx.id === this.activeContextId);
    if (context) {
      return {
        ...context,
        active: true
      };
    }
    return undefined;
  }

  public setActiveContext(contextId: string): void {
    this.activeContextId = contextId;
    this.contexts = this.contexts.map(ctx => ({
      ...ctx,
      active: ctx.id === contextId
    }));
    console.log('[ConversationService] Active context set:', contextId);
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
      type: context.type || 'chat',
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

  public addMessage(contextId: string, message: Message): void {
    const contextIndex = this.contexts.findIndex(ctx => ctx.id === contextId);
    if (contextIndex !== -1) {
      this.contexts[contextIndex] = {
        ...this.contexts[contextIndex],
        messages: [...(this.contexts[contextIndex].messages || []), message]
      };
      console.log('[ConversationService] Message added to context:', contextId);
    }
  }

  public updateContext(context: ConversationContext): void {
    const index = this.contexts.findIndex(ctx => ctx.id === context.id);
    if (index !== -1) {
      this.contexts[index] = context;
      console.log('[ConversationService] Context updated:', context.id);
    }
  }

  private subscribers: ((contexts: ConversationContext[]) => void)[] = [];

  private notifySubscribers(): void {
    this.subscribers.forEach(subscriber => subscriber([...this.contexts]));
  }

  public subscribe(callback: (contexts: ConversationContext[]) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  createNewContext(name?: string): ConversationContext {
    // Desactivar todos los contextos existentes
    this.contexts = this.contexts.map(ctx => ({
      ...ctx,
      active: false
    }));

    // Crear nuevo contexto
    const newContext: ConversationContext = {
      id: this.generateUniqueId(),
      name: name || `Chat ${this.contexts.length + 1}`,
      type: 'chat',
      wallet_address: '',
      created_at: '',
      last_accessed: '',
      messages: [],
      active: true
    };

    // Añadir nuevo contexto a la lista
    this.contexts.push(newContext);
    this.notifySubscribers();

    return newContext;
  }

  private generateUniqueId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

export const conversationService = new ConversationService(); 