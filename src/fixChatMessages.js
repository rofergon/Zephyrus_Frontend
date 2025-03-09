/**
 * Script para eliminar mensajes duplicados en el chat
 * 
 * Instrucciones de uso:
 * 1. Abre la consola del navegador (F12 o Ctrl+Shift+J)
 * 2. Copia y pega este script completo
 * 3. Presiona Enter para ejecutarlo
 */

(function() {
  console.log('Iniciando script para eliminar mensajes duplicados...');
  
  // 1. Obtener el servicio de chat
  const chatService = window.chatService || null;
  if (!chatService) {
    console.error('Error: No se pudo encontrar el servicio de chat.');
    return;
  }
  
  // 2. Obtener el contexto activo
  const getActiveContext = () => {
    // Intentar obtener el contexto desde diferentes lugares
    const appRoot = document.getElementById('root');
    if (!appRoot) {
      console.error('Error: No se pudo encontrar el elemento raíz de la aplicación.');
      return null;
    }
    
    // Acceder al estado de React
    const reactInstance = Object.keys(appRoot).find(key => key.startsWith('__reactFiber$'));
    if (!reactInstance) {
      console.error('Error: No se pudo acceder a la instancia de React.');
      return null;
    }
    
    // Extraer el contexto activo
    try {
      const fiber = appRoot[reactInstance];
      const state = fiber.memoizedState;
      if (state && state.memoizedState) {
        const contextObject = state.memoizedState.find(item => 
          item && item.memoizedState && item.memoizedState.id && item.memoizedState.messages
        );
        
        if (contextObject && contextObject.memoizedState) {
          return contextObject.memoizedState;
        }
      }
    } catch (error) {
      console.error('Error al extraer el contexto activo:', error);
    }
    
    // Alternativa: obtener desde localStorage
    try {
      const localStorageContexts = JSON.parse(localStorage.getItem('conversation_contexts') || '[]');
      if (localStorageContexts.length > 0) {
        const activeContext = localStorageContexts.find(ctx => ctx.active) || localStorageContexts[0];
        return activeContext;
      }
    } catch (error) {
      console.error('Error al obtener contextos desde localStorage:', error);
    }
    
    return null;
  };
  
  // 3. Función para eliminar mensajes duplicados
  const removeDuplicateMessages = (context) => {
    if (!context || !Array.isArray(context.messages)) {
      console.error('Error: El contexto no tiene mensajes válidos.');
      return null;
    }
    
    console.log(`Procesando ${context.messages.length} mensajes...`);
    
    // Ordenar mensajes por timestamp
    const sortedMessages = [...context.messages].sort((a, b) => {
      const timestampA = a.timestamp || 0;
      const timestampB = b.timestamp || 0;
      return new Date(timestampA).getTime() - new Date(timestampB).getTime();
    });
    
    // Eliminar duplicados
    const uniqueMessages = [];
    const messageMap = new Map();
    
    sortedMessages.forEach(msg => {
      const senderKey = msg.sender || 'unknown';
      const contentKey = msg.text || '';
      const messageKey = `${senderKey}:${contentKey}`;
      
      if (!messageMap.has(messageKey)) {
        messageMap.set(messageKey, true);
        uniqueMessages.push(msg);
      }
    });
    
    console.log(`Mensajes después de eliminar duplicados: ${uniqueMessages.length}`);
    
    return {
      ...context,
      messages: uniqueMessages
    };
  };
  
  // 4. Sincronizar el contexto actualizado
  const syncUpdatedContext = (updatedContext) => {
    if (!updatedContext) return;
    
    console.log('Sincronizando contexto actualizado...');
    
    // Actualizar localStorage
    try {
      const localStorageContexts = JSON.parse(localStorage.getItem('conversation_contexts') || '[]');
      const updatedStorageContexts = localStorageContexts.map(ctx => 
        ctx.id === updatedContext.id ? updatedContext : ctx
      );
      
      localStorage.setItem('conversation_contexts', JSON.stringify(updatedStorageContexts));
      console.log('Contexto actualizado en localStorage.');
    } catch (error) {
      console.error('Error al actualizar localStorage:', error);
    }
    
    // Sincronizar con el servicio de chat
    if (chatService.syncFullChatHistory) {
      try {
        const chatInfo = {
          id: updatedContext.id,
          name: updatedContext.name,
          wallet_address: updatedContext.wallet_address || '',
          created_at: updatedContext.created_at || new Date().toISOString(),
          last_accessed: new Date().toISOString(),
          messages: updatedContext.messages,
          type: 'chat',
          virtualFiles: updatedContext.virtualFiles || {},
          workspaces: updatedContext.workspaces || {}
        };
        
        chatService.syncFullChatHistory(updatedContext.id, chatInfo);
        console.log('Contexto sincronizado con el servicio de chat.');
      } catch (error) {
        console.error('Error al sincronizar con el servicio de chat:', error);
      }
    }
    
    // Recargar la página para aplicar los cambios
    if (confirm('¿Deseas recargar la página para aplicar los cambios?')) {
      window.location.reload();
    }
  };
  
  // Ejecutar el script
  const activeContext = getActiveContext();
  if (activeContext) {
    console.log('Contexto activo encontrado:', activeContext.id);
    const updatedContext = removeDuplicateMessages(activeContext);
    syncUpdatedContext(updatedContext);
  } else {
    console.error('No se pudo encontrar el contexto activo.');
  }
  
  console.log('Script completado.');
})(); 