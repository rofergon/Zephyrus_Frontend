import logging
import os
from typing import Dict, List

logger = logging.getLogger(__name__)

class EditActions:
    def __init__(self):
        self.current_contract_context = {
            "file": None,
            "code": None,
            "file_system": {}
        }
        self.active_contract = {
            "path": "contracts/Contract.sol",
            "content": None,
            "is_complete": False  # Flag para indicar si tenemos el contrato completo
        }

    def parse_actions(self, response: str) -> List[Dict]:
        """Analiza la respuesta para extraer acciones."""
        actions = []
        lines = response.split('\n')
        in_code_block = False
        code_content = ""
        is_suggestion_block = False
        is_edit_block = False
        
        # Si hay un contrato actual, cualquier código solidity debería ser una edición
        is_editing_mode = self.current_contract_context["file"] is not None or self.active_contract["is_complete"]

        for i, line in enumerate(lines):
            # Detectar si es una sugerencia antes del bloque de código
            if not in_code_block and any(keyword in line.lower() for keyword in ["suggestion:", "idea:", "you could:", "consider:", "recommendation:", "proposal:"]):
                is_suggestion_block = True
                actions.append({
                    "type": "message",
                    "content": line.strip()
                })
                continue

            # Detectar si es una edición
            if not in_code_block and any(keyword in line.lower() for keyword in ["edit", "modify", "update", "change", "add", "include"]):
                is_edit_block = True

            # Detectar inicio de bloque de código
            if line.startswith("```solidity"):
                in_code_block = True
                code_content = ""
                continue
            # Detectar fin de bloque de código
            elif line.startswith("```") and in_code_block:
                in_code_block = False
                if code_content.strip():
                    # Si es un bloque de sugerencia, solo mostrar el código como mensaje
                    if is_suggestion_block:
                        actions.append({
                            "type": "message",
                            "content": f"Example code:\n```solidity\n{code_content.strip()}\n```"
                        })
                    # Si estamos en modo edición o es un bloque de edición
                    elif is_editing_mode or is_edit_block:
                        if self.active_contract["content"] and not code_content.strip().startswith("//"):
                            # Si el código no parece un contrato completo, integrarlo en el existente
                            merged_content = self.merge_code(self.active_contract["content"], code_content.strip())
                            actions.append({
                                "type": "edit_file",
                                "path": self.active_contract["path"],
                                "edit": {"replace": merged_content}
                            })
                            self.active_contract["content"] = merged_content
                        else:
                            # Si es un contrato completo o no hay contrato activo, reemplazar/crear
                            actions.append({
                                "type": "create_file" if not self.active_contract["content"] else "edit_file",
                                "path": self.active_contract["path"],
                                "content" if not self.active_contract["content"] else "edit": {
                                    "replace": code_content.strip()
                                }
                            })
                            self.active_contract["content"] = code_content.strip()
                            self.active_contract["is_complete"] = True
                    else:
                        # Nuevo contrato
                        actions.append({
                            "type": "create_file",
                            "path": self.active_contract["path"],
                            "content": code_content.strip()
                        })
                        self.active_contract["content"] = code_content.strip()
                        self.active_contract["is_complete"] = True
                is_suggestion_block = False
                is_edit_block = False
                continue
            # Acumular contenido del bloque de código
            elif in_code_block:
                code_content += line + "\n"
            # Si la línea no es parte de un bloque de código y no está vacía
            elif line.strip():
                actions.append({
                    "type": "message",
                    "content": line.strip()
                })

        return actions

    def merge_code(self, existing_code: str, new_code: str) -> str:
        """Integra nuevo código en el contrato existente."""
        # Si el nuevo código parece ser una función o declaración
        if "function" in new_code or "event" in new_code or "enum" in new_code or "mapping" in new_code:
            # Encontrar la última llave de cierre del contrato
            last_brace_index = existing_code.rstrip().rfind("}")
            if last_brace_index != -1:
                # Insertar el nuevo código antes del último cierre
                return existing_code[:last_brace_index].rstrip() + "\n\n    " + new_code.strip() + "\n}" 
        
        return new_code

    def apply_edit(self, current_content: str, edit: Dict) -> str:
        """Aplica una edición a un contenido existente."""
        if "replace" in edit:
            return edit["replace"]
        
        if "insert" in edit:
            lines = current_content.splitlines()
            lines.insert(edit["line"] - 1, edit["insert"])
            return "\n".join(lines)
        
        return current_content

    def update_contract_context(self, file: str = None, code: str = None, file_system: dict = None):
        """Actualiza el contexto del contrato actual."""
        if file is not None:
            self.current_contract_context["file"] = file
            self.active_contract["path"] = file
        if code is not None:
            self.current_contract_context["code"] = code
            self.active_contract["content"] = code
            self.active_contract["is_complete"] = True
        if file_system is not None:
            self.current_contract_context["file_system"] = file_system  