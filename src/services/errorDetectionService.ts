import { ConsoleMessage } from '../types/contracts';
import { ChatService } from './chatService';
import { generateUniqueId } from '../utils/commonUtils';

export interface ErrorFix {
  id: string;
  error: string;
  timestamp: number;
  fixed: boolean;
}

export class ErrorDetectionService {
  private static instance: ErrorDetectionService;
  private recentErrors: Map<string, ErrorFix> = new Map();
  private chatService: ChatService | null = null;
  private onErrorDetectedCallback: ((error: ErrorFix) => void) | null = null;
  
  private constructor() {}
  
  public static getInstance(): ErrorDetectionService {
    if (!ErrorDetectionService.instance) {
      ErrorDetectionService.instance = new ErrorDetectionService();
    }
    return ErrorDetectionService.instance;
  }
  
  public initialize(chatService: ChatService): void {
    this.chatService = chatService;
    console.log('[ErrorDetectionService] Initialized with chat service');
  }
  
  public onErrorDetected(callback: (error: ErrorFix) => void): void {
    this.onErrorDetectedCallback = callback;
    console.log('[ErrorDetectionService] Error detection callback registered');
  }
  
  public detectErrors(consoleMessage: ConsoleMessage): ErrorFix | null {
    // Only process error messages
    if (consoleMessage.type !== 'error') {
      return null;
    }
    
    console.log('[ErrorDetectionService] Processing error message:', consoleMessage.content);
    
    // Check if we've already processed this error (based on content)
    const errorSignature = this.getErrorSignature(consoleMessage.content);
    if (this.recentErrors.has(errorSignature)) {
      console.log('[ErrorDetectionService] Error already recorded:', errorSignature);
      return this.recentErrors.get(errorSignature) || null;
    }
    
    // Create a new error fix entry
    const errorFix: ErrorFix = {
      id: generateUniqueId(),
      error: consoleMessage.content,
      timestamp: Date.now(),
      fixed: false
    };
    
    // Store the error in our map
    this.recentErrors.set(errorSignature, errorFix);
    
    // Call the callback if registered
    if (this.onErrorDetectedCallback) {
      this.onErrorDetectedCallback(errorFix);
    }
    
    console.log('[ErrorDetectionService] New error detected:', errorFix);
    return errorFix;
  }
  
  public requestFix(errorFix: ErrorFix): void {
    if (!this.chatService) {
      console.error('[ErrorDetectionService] Cannot request fix, chat service not initialized');
      return;
    }
    
    if (errorFix.fixed) {
      console.log('[ErrorDetectionService] Error already fixed:', errorFix.id);
      return;
    }
    
    // Send a fix request to the WebSocket backend
    const fixRequest = `Fix this error: ${errorFix.error}`;
    this.chatService.sendMessage(fixRequest);
    
    // Mark the error as fixed
    errorFix.fixed = true;
    this.recentErrors.set(this.getErrorSignature(errorFix.error), errorFix);
    
    console.log('[ErrorDetectionService] Fix requested for error:', errorFix.id);
  }
  
  private getErrorSignature(errorContent: string): string {
    // Create a simplified version of the error to use as a signature
    // This helps prevent duplicate error entries for very similar errors
    return errorContent
      .trim()
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .substring(0, 100);
  }
  
  public clearErrors(): void {
    this.recentErrors.clear();
    console.log('[ErrorDetectionService] Error cache cleared');
  }
  
  public getRecentErrors(): ErrorFix[] {
    return Array.from(this.recentErrors.values())
      .sort((a, b) => b.timestamp - a.timestamp);
  }
}

export default ErrorDetectionService.getInstance(); 