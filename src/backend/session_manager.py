import json
import os
from datetime import datetime
import uuid
import logging
from typing import List

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Chat:
    def __init__(self, chat_id: str, name: str, wallet_address: str):
        self.chat_id = chat_id
        self.name = name
        self.wallet_address = wallet_address
        self.created_at = datetime.now().isoformat()
        self.last_accessed = datetime.now().isoformat()
        self.messages = []
        self.active_files = {}  # {base_name: {content, language, timestamp}}
        self.file_history = {}  # {base_name: [{content, timestamp}]}
        logger.info(f"Created new chat: {chat_id} for wallet: {wallet_address}")

    def to_dict(self) -> dict:
        # Solo incluir los archivos activos en la serialización
        return {
            "id": self.chat_id,
            "name": self.name,
            "wallet_address": self.wallet_address,
            "created_at": self.created_at,
            "last_accessed": self.last_accessed,
            "messages": self.messages,
            "type": "chat",
            "virtualFiles": {
                f"contracts/{name}": file_data 
                for name, file_data in self.active_files.items()
            }
        }

    def add_message(self, message: dict) -> None:
        self.messages.append(message)
        self.last_accessed = datetime.now().isoformat()

    def add_virtual_file(self, path: str, content: str, language: str = "solidity") -> None:
        """Añade o actualiza un archivo virtual en el chat."""
        current_time = datetime.now().timestamp() * 1000
        
        # Extraer el nombre base del archivo (eliminar timestamp si existe)
        base_name = os.path.basename(path).replace(".sol", "")
        base_name = base_name.split("_")[0] + ".sol"
        
        # Si el contenido es diferente al actual, crear nueva versión
        if base_name in self.active_files:
            current = self.active_files[base_name]
            if content != current["content"]:
                # Guardar versión anterior en el historial
                if base_name not in self.file_history:
                    self.file_history[base_name] = []
                self.file_history[base_name].append({
                    "content": current["content"],
                    "timestamp": current["timestamp"]
                })
                # Mantener solo las últimas 5 versiones en el historial
                if len(self.file_history[base_name]) > 5:
                    self.file_history[base_name] = self.file_history[base_name][-5:]
        
        # Actualizar archivo activo
        self.active_files[base_name] = {
            "content": content,
            "language": language,
            "timestamp": current_time
        }
        
        self.last_accessed = datetime.now().isoformat()

    def get_virtual_file(self, path: str, version: int = None) -> dict | None:
        """Obtiene un archivo virtual del chat, opcionalmente una versión específica."""
        base_name = os.path.basename(path).replace(".sol", "").split("_")[0] + ".sol"
        
        if version is None:
            # Retornar versión activa
            if base_name in self.active_files:
                return self.active_files[base_name]
            return None
            
        # Retornar versión específica del historial
        if base_name in self.file_history:
            history = self.file_history[base_name]
            if 0 <= version < len(history):
                return history[version]
        
        return None

    def delete_virtual_file(self, path: str) -> None:
        """Elimina un archivo virtual del chat."""
        base_name = os.path.basename(path).replace(".sol", "").split("_")[0] + ".sol"
        if base_name in self.active_files:
            del self.active_files[base_name]
            if base_name in self.file_history:
                del self.file_history[base_name]
        self.last_accessed = datetime.now().isoformat()

    def get_file_history(self, path: str) -> List[dict]:
        """Obtiene el historial de versiones de un archivo."""
        base_name = os.path.basename(path).replace(".sol", "").split("_")[0] + ".sol"
        if base_name in self.file_history:
            return self.file_history[base_name]
        return []

class ChatManager:
    def __init__(self, base_path: str = "./chats"):
        self.base_path = base_path
        self.chats = {}  # wallet_address -> {chat_id -> Chat}
        self._ensure_base_path()
        self._load_chats()

    def _ensure_base_path(self):
        if not os.path.exists(self.base_path):
            os.makedirs(self.base_path)

    def _get_chat_path(self, wallet_address: str, chat_id: str) -> str:
        wallet_dir = os.path.join(self.base_path, wallet_address)
        if not os.path.exists(wallet_dir):
            os.makedirs(wallet_dir)
        return os.path.join(wallet_dir, f"{chat_id}.json")

    def _load_chats(self):
        if not os.path.exists(self.base_path):
            return

        for wallet_dir in os.listdir(self.base_path):
            wallet_path = os.path.join(self.base_path, wallet_dir)
            if os.path.isdir(wallet_path):
                self.chats[wallet_dir] = {}
                for chat_file in os.listdir(wallet_path):
                    if chat_file.endswith(".json"):
                        chat_path = os.path.join(wallet_path, chat_file)
                        try:
                            with open(chat_path, 'r', encoding='utf-8') as f:
                                data = json.load(f)
                                chat = Chat(
                                    data["id"],
                                    data["name"],
                                    data["wallet_address"]
                                )
                                chat.created_at = data["created_at"]
                                chat.last_accessed = data["last_accessed"]
                                chat.messages = data.get("messages", [])
                                chat.active_files = data.get("virtualFiles", {})  # Nuevo: cargar archivos virtuales
                                self.chats[wallet_dir][chat.chat_id] = chat
                        except Exception as e:
                            logger.error(f"Error loading chat {chat_file}: {str(e)}")

    def create_chat(self, wallet_address: str, name: str = None) -> Chat:
        if wallet_address not in self.chats:
            self.chats[wallet_address] = {}
            
        chat_id = str(uuid.uuid4())
        chat_name = name or f"Chat {len(self.chats[wallet_address]) + 1}"
        chat = Chat(chat_id, chat_name, wallet_address)
        
        self.chats[wallet_address][chat_id] = chat
        self._save_chat(chat)
        return chat

    def get_user_chats(self, wallet_address: str) -> list:
        return [chat.to_dict() for chat in self.chats.get(wallet_address, {}).values()]

    def get_chat(self, wallet_address: str, chat_id: str) -> Chat | None:
        return self.chats.get(wallet_address, {}).get(chat_id)

    def add_message_to_chat(self, wallet_address: str, chat_id: str, message: dict) -> None:
        chat = self.get_chat(wallet_address, chat_id)
        if chat:
            chat.add_message(message)
            self._save_chat(chat)
        else:
            raise ValueError(f"Chat {chat_id} not found for wallet {wallet_address}")

    def add_virtual_file_to_chat(self, wallet_address: str, chat_id: str, path: str, content: str, language: str = "solidity") -> None:
        """Añade o actualiza un archivo virtual en un chat específico."""
        chat = self.get_chat(wallet_address, chat_id)
        if chat:
            chat.add_virtual_file(path, content, language)
            self._save_chat(chat)
        else:
            raise ValueError(f"Chat {chat_id} not found for wallet {wallet_address}")

    def get_virtual_file_from_chat(self, wallet_address: str, chat_id: str, path: str) -> dict | None:
        """Obtiene un archivo virtual de un chat específico."""
        chat = self.get_chat(wallet_address, chat_id)
        if chat:
            return chat.get_virtual_file(path)
        return None

    def delete_virtual_file_from_chat(self, wallet_address: str, chat_id: str, path: str) -> None:
        """Elimina un archivo virtual de un chat específico."""
        chat = self.get_chat(wallet_address, chat_id)
        if chat:
            chat.delete_virtual_file(path)
            self._save_chat(chat)
        else:
            raise ValueError(f"Chat {chat_id} not found for wallet {wallet_address}")

    def _save_chat(self, chat: Chat):
        try:
            chat_path = self._get_chat_path(chat.wallet_address, chat.chat_id)
            with open(chat_path, 'w', encoding='utf-8') as f:
                json.dump(chat.to_dict(), f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Error saving chat {chat.chat_id}: {str(e)}")

    def delete_chat(self, wallet_address: str, chat_id: str) -> None:
        """Elimina un chat específico."""
        try:
            chat = self.get_chat(wallet_address, chat_id)
            if not chat:
                raise ValueError(f"Chat {chat_id} not found for wallet {wallet_address}")
            
            # Eliminar el archivo del chat
            chat_path = self._get_chat_path(wallet_address, chat_id)
            if os.path.exists(chat_path):
                os.remove(chat_path)
            
            # Eliminar de la memoria
            if wallet_address in self.chats and chat_id in self.chats[wallet_address]:
                del self.chats[wallet_address][chat_id]
            
            logger.info(f"Deleted chat {chat_id} for wallet {wallet_address}")
        except Exception as e:
            logger.error(f"Error deleting chat {chat_id}: {str(e)}")
            raise 