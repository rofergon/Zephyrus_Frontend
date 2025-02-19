import { virtualFS } from '../services/virtual-fs';
import 'react-resizable/css/styles.css';
import AssistedChat from './AssistedChat';

// Asegurarse de que virtualFS está inicializado
if (!virtualFS) {
  console.error('[Chat] VirtualFileSystem instance not found');
  throw new Error('VirtualFileSystem instance not found');
}

console.log('[Chat] VirtualFileSystem instance found');







// Generador de IDs únicos usando UUID v4

function Chat() {
  return <AssistedChat />;
}

export default Chat;