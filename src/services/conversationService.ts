import { sessionService, type Session } from './sessionService';

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
  type: 'chat' | 'contract';
  timestamp: number;
  content: string;
  active: boolean;
  messages: Message[];
}

export class ConversationService {
  private contexts: ConversationContext[] = [];
  private subscribers: ((contexts: ConversationContext[]) => void)[] = [];

  public setContexts(contexts: ConversationContext[]): void {
    this.contexts = contexts;
    this.notifySubscribers();
  }

  public addContext(context: ConversationContext): void {
    // Desactivar todos los contextos existentes
    this.contexts = this.contexts.map(ctx => ({
      ...ctx,
      active: false
    }));
    
    // Añadir el nuevo contexto
    this.contexts.push(context);
    this.notifySubscribers();
  }

  public setActiveContext(contextId: string): void {
    const contextExists = this.contexts.some(ctx => ctx.id === contextId);
    if (!contextExists) {
      console.error(`Context ${contextId} not found`);
      return;
    }
    
    this.contexts = this.contexts.map(ctx => ({
      ...ctx,
      active: ctx.id === contextId
    }));
    this.notifySubscribers();
  }

  public getActiveContext(): ConversationContext | null {
    return this.contexts.find(ctx => ctx.active) || null;
  }

  public addMessage(contextId: string, message: Message): void {
    const context = this.contexts.find(ctx => ctx.id === contextId);
    if (!context) {
      console.error(`Context ${contextId} not found`);
      return;
    }

    // Crear una nueva referencia del contexto con el mensaje añadido
    const updatedContext = {
      ...context,
      messages: [...(context.messages || []), message]
    };

    // Actualizar el array de contextos con el contexto modificado
    this.contexts = this.contexts.map(ctx => 
      ctx.id === contextId ? updatedContext : ctx
    );

    this.notifySubscribers();
  }

  private notifySubscribers(): void {
    this.subscribers.forEach(subscriber => subscriber([...this.contexts]));
  }

  public subscribe(callback: (contexts: ConversationContext[]) => void): () => void {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  async initializeSession(sessionId: string): Promise<void> {
    try {
      // Mantener los contextos existentes si ya existen
      if (this.contexts.length === 0) {
        // Crear contexto inicial solo si no hay contextos
        const initialContext: ConversationContext = {
          id: sessionId,
          name: 'Main Chat',
          type: 'chat',
          timestamp: Date.now(),
          content: '',
          active: true,
          messages: []
        };
        this.contexts = [initialContext];
      }
      
      // Asegurar que al menos un contexto esté activo
      const hasActiveContext = this.contexts.some(ctx => ctx.active);
      if (!hasActiveContext && this.contexts.length > 0) {
        this.contexts[0].active = true;
      }
      
      this.notifySubscribers();
    } catch (error) {
      console.error('Error initializing session:', error);
      throw error;
    }
  }

  getContexts(): ConversationContext[] {
    return [...this.contexts];
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
      timestamp: Date.now(),
      content: '',
      active: true,
      messages: []
    };

    // Añadir nuevo contexto a la lista
    this.contexts.push(newContext);
    this.notifySubscribers();

    return newContext;
  }

  switchContext(contextId: string): ConversationContext {
    // Actualizar el estado de activo para todos los contextos
    this.contexts = this.contexts.map(ctx => ({
      ...ctx,
      active: ctx.id === contextId
    }));

    this.notifySubscribers();
    const activeContext = this.contexts.find(ctx => ctx.active);
    if (!activeContext) {
      throw new Error('Context not found');
    }

    return activeContext;
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