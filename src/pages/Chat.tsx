import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Editor, { Monaco } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import { ResizableBox } from 'react-resizable';
import FileExplorer from '../components/FileExplorer';
import { virtualFS } from '../services/virtual-fs';
import { ChatService } from '../services/chatService';
import 'react-resizable/css/styles.css';
import { XMarkIcon, Bars3Icon } from '@heroicons/react/24/outline';
import SessionList from '../components/SessionList';
import { sessionService } from '../services/sessionService';
import { useAccount } from 'wagmi';
import AssistedChat from './AssistedChat';
import { conversationService } from '../services/conversationService';

// Asegurarse de que virtualFS está inicializado
if (!virtualFS) {
  console.error('[Chat] VirtualFileSystem instance not found');
  throw new Error('VirtualFileSystem instance not found');
}

console.log('[Chat] VirtualFileSystem instance found');

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'system';
  timestamp: number;
}

interface Marker {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  message: string;
  severity: number;
}

interface Snippets {
  [key: string]: string;
}

interface WorkerMessage {
  markers?: Marker[];
  error?: string;
  output?: any;
}

interface AgentResponse {
  type: 'message' | 'code_edit' | 'file_create' | 'file_delete';
  content: string;
  metadata?: {
    fileName?: string;
    path?: string;
    language?: string;
  };
}

interface WebSocketResponse {
  type: 'message' | 'code_edit' | 'file_create' | 'file_delete';
  content: string;
  metadata?: {
    fileName?: string;
    path?: string;
    language?: string;
  };
}

// Generador de IDs únicos usando UUID v4
const generateUniqueId = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

function Chat() {
  return <AssistedChat />;
}

export default Chat;