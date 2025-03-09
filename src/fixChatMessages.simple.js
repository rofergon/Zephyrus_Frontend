/**
 * Script para eliminar mensajes duplicados en el chat (VERSIÓN SIMPLE)
 * 
 * Instrucciones de uso:
 * 1. Abre la aplicación en el navegador y espera a que se cargue completamente
 * 2. Abre la consola del navegador (F12 o Ctrl+Shift+J)
 * 3. Copia y pega todo este script en la consola
 * 4. Presiona Enter para ejecutarlo
 * 5. Si el script funciona correctamente, verás un mensaje de confirmación
 * 6. Recarga la página para ver los cambios
 */

(function() {
  console.log('🔄 Iniciando reparación de mensajes duplicados...');
  
  // Obtener mensajes del localStorage
  const getContextsFromStorage = () => {
    try {
      const contextData = localStorage.getItem('conversation_contexts');
      if (!contextData) return null;
      
      const contexts = JSON.parse(contextData);
      if (!Array.isArray(contexts) || contexts.length === 0) return null;
      
      return contexts;
    } catch (error) {
      console.error('❌ Error al leer contexts de localStorage:', error);
      return null;
    }
  };
  
  // Función para encontrar y eliminar mensajes duplicados
  const removeDuplicates = (messages) => {
    if (!Array.isArray(messages)) return [];
    
    // Ordenar mensajes por timestamp
    const sortedMessages = [...messages].sort((a, b) => {
      const timestampA = a.timestamp || 0;
      const timestampB = b.timestamp || 0;
      return timestampA - timestampB; // De más antiguo a más reciente
    });
    
    // Eliminar duplicados
    const uniqueMessages = [];
    const messageMap = new Map();
    
    sortedMessages.forEach(msg => {
      if (!msg.sender || !msg.text) return; // Ignorar mensajes inválidos
      
      const senderKey = msg.sender;
      const contentKey = msg.text;
      const messageKey = `${senderKey}:${contentKey}`;
      
      if (!messageMap.has(messageKey)) {
        messageMap.set(messageKey, true);
        uniqueMessages.push(msg);
      }
    });
    
    return uniqueMessages;
  };

  // Marcar todos los mensajes como mensajes "completos"
  const markMessagesAsComplete = (messages) => {
    return messages.map(msg => ({
      ...msg,
      isFullMessage: true // Esto evita que los mensajes se consideren como fragmentos
    }));
  };
  
  // Ejecutar la reparación
  const contexts = getContextsFromStorage();
  if (!contexts) {
    console.error('❌ No se encontraron contextos en localStorage');
    return;
  }
  
  console.log(`🔍 Encontrados ${contexts.length} contextos`);
  
  // Procesar cada contexto
  const updatedContexts = contexts.map(context => {
    if (!context.messages) {
      console.log(`⚠️ Contexto ${context.id} no tiene mensajes`);
      return context;
    }
    
    console.log(`🔍 Procesando contexto: ${context.name || context.id}`);
    console.log(`📊 Mensajes antes: ${context.messages.length}`);
    
    // Eliminar duplicados
    const uniqueMessages = removeDuplicates(context.messages);
    
    // Marcar como mensajes completos
    const processedMessages = markMessagesAsComplete(uniqueMessages);
    
    console.log(`✅ Mensajes después: ${processedMessages.length}`);
    
    return {
      ...context,
      messages: processedMessages
    };
  });
  
  // Guardar contextos actualizados en localStorage
  try {
    localStorage.setItem('conversation_contexts', JSON.stringify(updatedContexts));
    console.log('✅ Contextos actualizados guardados en localStorage');
    
    // Sincronizar con el backend a través del chatService si está disponible
    try {
      const chatService = window.chatService;
      if (chatService && typeof chatService.syncFullChatHistory === 'function') {
        const activeContext = updatedContexts.find(ctx => ctx.active);
        if (activeContext) {
          console.log('🔄 Sincronizando contexto activo con el backend...');
          const chatInfo = {
            id: activeContext.id,
            name: activeContext.name,
            wallet_address: localStorage.getItem('wallet_address') || '',
            created_at: activeContext.created_at || new Date().toISOString(),
            last_accessed: new Date().toISOString(),
            messages: activeContext.messages,
            type: 'chat',
            virtualFiles: activeContext.virtualFiles || {},
            workspaces: activeContext.workspaces || {}
          };
          
          chatService.syncFullChatHistory(activeContext.id, chatInfo);
          console.log('✅ Contexto sincronizado con el backend');
        }
      } else {
        console.log('⚠️ No se encontró chatService para sincronizar con el backend');
      }
    } catch (error) {
      console.error('❌ Error al sincronizar con el backend:', error);
    }
    
    // Mensaje para el usuario
    alert('✅ Reparación completada exitosamente.\nRecarga la página para ver los cambios.');
  } catch (error) {
    console.error('❌ Error al guardar contextos en localStorage:', error);
  }
})(); 