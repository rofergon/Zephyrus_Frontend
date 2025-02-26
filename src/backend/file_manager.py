import os
import json
import aiofiles
import logging
from typing import Dict, List, Optional
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import asyncio
import typing

logger = logging.getLogger(__name__)

class FileSystemWatcher(FileSystemEventHandler):
    def __init__(self, callback):
        self.callback = callback

    def on_modified(self, event):
        if not event.is_directory:
            self.callback(event.src_path)

class FileManager:
    def __init__(self, base_path: str = "../"):
        self.base_path = os.path.abspath(base_path)
        self.file_cache: dict[str, str] = {}
        self.observers: list[Observer] = [] # type: ignore
        self._setup_watcher()

    def _setup_watcher(self):
        observer = Observer()
        event_handler = FileSystemWatcher(self._on_file_changed)
        observer.schedule(event_handler, self.base_path, recursive=True)
        observer.start()
        self.observers.append(observer)

    def _on_file_changed(self, file_path: str):
        relative_path = os.path.relpath(file_path, self.base_path)
        if relative_path in self.file_cache:
            del self.file_cache[relative_path]

    async def read_file(self, path: str) -> str:
        """Lee el contenido de un archivo."""
        full_path = os.path.join(self.base_path, path)
        try:
            if path in self.file_cache:
                return self.file_cache[path]

            async with aiofiles.open(full_path, mode='r', encoding='utf-8') as file:
                content = await file.read()
                self.file_cache[path] = content
                return content
        except Exception as e:
            logger.error(f"Error reading file {path}: {str(e)}")
            raise

    async def write_file(self, path: str, content: str) -> None:
        """Escribe contenido en un archivo."""
        full_path = os.path.join(self.base_path, path)
        try:
            # Asegurarse de que el directorio existe
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            
            async with aiofiles.open(full_path, mode='w', encoding='utf-8') as file:
                await file.write(content)
                self.file_cache[path] = content
        except Exception as e:
            logger.error(f"Error writing file {path}: {str(e)}")
            raise

    async def delete_file(self, path: str) -> None:
        """Elimina un archivo."""
        full_path = os.path.join(self.base_path, path)
        try:
            os.remove(full_path)
            if path in self.file_cache:
                del self.file_cache[path]
        except Exception as e:
            logger.error(f"Error deleting file {path}: {str(e)}")
            raise

    async def list_files(self, directory: str = "") -> List[Dict[str, str]]:
        """Lista todos los archivos en un directorio."""
        full_path = os.path.join(self.base_path, directory)
        try:
            files = []
            for root, dirs, filenames in os.walk(full_path):
                rel_root = os.path.relpath(root, self.base_path)
                for dir_name in dirs:
                    files.append({
                        "name": dir_name,
                        "path": os.path.join(rel_root, dir_name).replace("\\", "/"),
                        "type": "directory"
                    })
                for filename in filenames:
                    files.append({
                        "name": filename,
                        "path": os.path.join(rel_root, filename).replace("\\", "/"),
                        "type": "file"
                    })
            return files
        except Exception as e:
            logger.error(f"Error listing files in {directory}: {str(e)}")
            raise

    async def move_file(self, source: str, target: str) -> None:
        """Mueve un archivo de una ubicación a otra."""
        source_path = os.path.join(self.base_path, source)
        target_path = os.path.join(self.base_path, target)
        try:
            os.makedirs(os.path.dirname(target_path), exist_ok=True)
            os.rename(source_path, target_path)
            if source in self.file_cache:
                self.file_cache[target] = self.file_cache[source]
                del self.file_cache[source]
        except Exception as e:
            logger.error(f"Error moving file from {source} to {target}: {str(e)}")
            raise

    def __del__(self):
        """Limpieza al destruir la instancia."""
        for observer in self.observers:
            observer.stop()
        for observer in self.observers:
            observer.join()

    async def get_file_content(self, path: str, start_line: Optional[int] = None, end_line: Optional[int] = None) -> str:
        """Obtiene el contenido de un archivo, opcionalmente solo un rango de líneas."""
        content = await self.read_file(path)
        if start_line is None or end_line is None:
            return content
            
        lines = content.splitlines()
        if start_line < 1:
            start_line = 1
        if end_line > len(lines):
            end_line = len(lines)
            
        return '\n'.join(lines[start_line - 1:end_line])

    async def compile_solidity(self, file_path: str) -> Dict:
        """Compila un contrato Solidity y retorna los errores si los hay."""
        # Esta es una implementación simulada. En un entorno real,
        # necesitarías integrar con solc o usar una biblioteca como py-solc-x
        try:
            content = await self.read_file(file_path)
            # Aquí iría la lógica real de compilación
            # Por ahora, solo verificamos algunas reglas básicas
            errors = []
            lines = content.splitlines()
            
            for i, line in enumerate(lines, 1):
                if "pragma solidity" not in content:
                    errors.append({
                        "line": 1,
                        "message": "Missing pragma solidity directive"
                    })
                if "contract" not in content:
                    errors.append({
                        "line": 1,
                        "message": "No contract definition found"
                    })
                    
            return {
                "success": len(errors) == 0,
                "errors": errors
            }
        except Exception as e:
            logger.error(f"Error compiling {file_path}: {str(e)}")
            return {
                "success": False,
                "errors": [{
                    "line": 1,
                    "message": f"Compilation error: {str(e)}"
                }]
            } 