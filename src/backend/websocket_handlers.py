from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict
import json
import logging
from datetime import datetime
import uuid
from connection_manager import ConnectionManager

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def handle_websocket_connection(
    websocket: WebSocket,
    wallet_address: str | None,
    manager: ConnectionManager
):
    # Validar que el wallet_address sea una dirección válida
    if not wallet_address or not wallet_address.startswith('0x'):
        await websocket.close(code=1008, reason="Invalid wallet address")
        return

    try:
        await manager.connect(websocket, wallet_address)
        
        while True:
            try:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                content = message_data.get("content", "")
                context = message_data.get("context", {})
                message_type = message_data.get("type", "message")
                chat_id = message_data.get("chat_id")

                if message_type == "save_file":
                    try:
                        path = message_data.get("path")
                        if not path:
                            raise ValueError("No path provided for file")
                        
                        # Guardar el archivo en el chat
                        manager.chat_manager.add_virtual_file_to_chat(
                            wallet_address,
                            chat_id,
                            path,
                            content,
                            message_data.get("language", "solidity")
                        )
                        
                        # Enviar confirmación al cliente
                        await manager.send_message(
                            json.dumps({
                                "type": "file_saved",
                                "content": f"File saved successfully: {path}",
                                "metadata": {
                                    "path": path,
                                    "chat_id": chat_id
                                }
                            }),
                            wallet_address
                        )
                        continue
                    except Exception as e:
                        logger.error(f"Error saving file: {str(e)}")
                        await manager.send_message(
                            json.dumps({
                                "type": "error",
                                "content": f"Error saving file: {str(e)}"
                            }),
                            wallet_address
                        )
                        continue

                elif message_type == "get_file_version":
                    try:
                        path = message_data.get("path")
                        version = message_data.get("version")
                        if not path:
                            raise ValueError("No path provided for file")
                        
                        # Obtener la versión del archivo
                        file_data = manager.chat_manager.get_virtual_file_from_chat(
                            wallet_address,
                            chat_id,
                            path,
                            version
                        )
                        
                        if file_data:
                            await manager.send_message(
                                json.dumps({
                                    "type": "file_version",
                                    "content": file_data["content"],
                                    "metadata": {
                                        "path": path,
                                        "chat_id": chat_id,
                                        "version": version,
                                        "timestamp": file_data["timestamp"]
                                    }
                                }),
                                wallet_address
                            )
                        else:
                            await manager.send_message(
                                json.dumps({
                                    "type": "error",
                                    "content": f"File version not found: {path}"
                                }),
                                wallet_address
                            )
                        continue
                    except Exception as e:
                        logger.error(f"Error getting file version: {str(e)}")
                        await manager.send_message(
                            json.dumps({
                                "type": "error",
                                "content": f"Error getting file version: {str(e)}"
                            }),
                            wallet_address
                        )
                        continue

                # Crear un nuevo mensaje en el chat
                if chat_id:
                    manager.chat_manager.add_message_to_chat(
                        wallet_address,
                        chat_id,
                        {
                            "id": str(uuid.uuid4()),
                            "text": content,
                            "sender": "user",
                            "timestamp": datetime.now().timestamp() * 1000
                        }
                    )

                # Procesar el mensaje con el agente
                agent = manager.agents[wallet_address]
                response_generator = agent.process_message(content, context, chat_id)
                
                async for response in response_generator:
                    if chat_id:
                        # Save AI response to chat
                        manager.chat_manager.add_message_to_chat(
                            wallet_address,
                            chat_id,
                            {
                                "id": str(uuid.uuid4()),
                                "text": response["content"],
                                "sender": "ai",
                                "timestamp": datetime.now().timestamp() * 1000,
                                "type": response["type"]
                            }
                        )
                        
                        # Si es un mensaje de tipo file_create o code_edit, guardar el archivo en el chat
                        if response["type"] in ["file_create", "code_edit"] and response.get("metadata", {}).get("path"):
                            manager.chat_manager.add_virtual_file_to_chat(
                                wallet_address,
                                chat_id,
                                response["metadata"]["path"],
                                response["content"],
                                response["metadata"].get("language", "solidity")
                            )
                    
                    # Send response to client
                    await manager.send_message(
                        json.dumps(response),
                        wallet_address
                    )
                    
            except json.JSONDecodeError:
                logger.error(f"Invalid JSON received: {data}")
                await manager.send_message(
                    json.dumps({
                        "type": "error",
                        "content": "Invalid message format"
                    }),
                    wallet_address
                )
                
    except WebSocketDisconnect:
        manager.disconnect(wallet_address)
    except Exception as e:
        logger.error(f"Error in websocket connection: {str(e)}")
        manager.disconnect(wallet_address) 