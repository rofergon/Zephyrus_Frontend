import logging
from typing import Dict, List, AsyncGenerator
import asyncio
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

class MessageActions:
    def __init__(self, anthropic_client, edit_actions, compilation_actions):
        self.anthropic = anthropic_client
        self.edit_actions = edit_actions
        self.compilation_actions = compilation_actions
        self.conversation_histories: Dict[str, List[Dict]] = {}
        self.max_retries = 3

    async def process_message(self, message: str, context: Dict, context_id: str | None = None) -> AsyncGenerator[Dict, None]:
        """Procesa un mensaje del usuario y genera respuestas."""
        try:
            # Inicializar el historial del contexto si no existe
            if context_id and context_id not in self.conversation_histories:
                self.conversation_histories[context_id] = []
            
            # Actualizar el historial del contexto actual
            if context_id:
                self.conversation_histories[context_id].append({
                    "role": "user",
                    "content": message
                })
                current_history = self.conversation_histories[context_id]
            else:
                # Si no hay context_id, usar un historial temporal
                current_history = [{
                    "role": "user",
                    "content": message
                }]

            # Update contract context if provided in the message
            if context.get("currentFile"):
                self.edit_actions.update_contract_context(
                    file=context["currentFile"],
                    code=context.get("currentCode"),
                    file_system=context.get("fileSystem", {})
                )

            # Preparar el contexto del sistema
            system_prompt = """You are an AI assistant specialized in Solidity smart contract development.
Your task is to help users write, edit, and debug smart contracts.

IMPORTANT RULES FOR CONTRACT EDITING:
1. When editing a contract, ALWAYS:
   - First acknowledge the current contract state
   - Show the COMPLETE contract with your changes integrated
   - Use ```solidity blocks for the complete updated contract
   - Maintain the existing contract structure
   - Preserve all existing functionality
   - Add new functionality in the appropriate location

2. When adding new functions or features:
   - DO NOT show only the new code
   - Instead, show the entire contract with the new code integrated
   - Place new functions in a logical location within the contract
   - Maintain consistent formatting and style

3. Contract Version and License:
   - ALWAYS use Solidity version 0.8.20 (pragma solidity ^0.8.20;)
   - ALWAYS include SPDX-License-Identifier
   - Preserve existing imports and inheritance

4. Response Format:
   - First explain what changes you're making
   - Then show the COMPLETE updated contract
   - Finally explain any additional considerations

5. Context Awareness:
   - Keep track of all previous edits and changes
   - Each response should reflect the most current state of the contract
   - Never revert to an earlier version unless explicitly requested

6. Code Suggestions:
   - When making suggestions, prefix with "Suggestion:" or "Idea:"
   - For suggestions, you can show partial code examples
   - But for actual edits, always show the complete contract

Example of a good edit response:
"I'll add the new function `checkBalance` to the contract. Here's the complete updated contract with the new function integrated:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ExistingContract {
    // Existing code...
    
    // New function added
    function checkBalance() public view returns (uint256) {
        return balance;
    }
    
    // Rest of existing code...
}
```"

Remember: NEVER show just the new code alone - always show the complete updated contract with new code integrated into the appropriate location."""

            try:
                # Obtener la respuesta de Claude
                response = await self.anthropic.messages.create(
                    model="claude-3-sonnet-20240229",
                    max_tokens=4096,
                    system=system_prompt,
                    messages=current_history,
                    temperature=0.7
                )
                
                if not response or not hasattr(response, 'content') or not response.content:
                    raise ValueError("Respuesta inválida de la API de Anthropic")

                # Guardar la respuesta en el historial del contexto
                if context_id:
                    self.conversation_histories[context_id].append({
                        "role": "assistant",
                        "content": response.content[0].text
                    })

                # Procesar la respuesta
                response_content = response.content[0].text
                yield {"type": "message", "content": "Analyzing your request..."}
                await asyncio.sleep(0.5)  # Pequeña pausa inicial

                # Analizar la respuesta para acciones específicas
                actions = self.edit_actions.parse_actions(response_content)
                
                for action in actions:
                    yield await self.handle_action(action, context_id)
                    await asyncio.sleep(0.4)  # Pausa entre acciones

            except Exception as api_error:
                logger.error(f"Error en la API de Anthropic: {str(api_error)}")
                yield {
                    "type": "error",
                    "content": f"Error al comunicarse con la API de Anthropic: {str(api_error)}"
                }

        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            yield {
                "type": "error",
                "content": f"Error: {str(e)}"
            }

    async def handle_action(self, action: Dict, context_id: str | None = None) -> Dict:
        """Maneja una acción específica y retorna la respuesta apropiada."""
        action_type = action.get("type")
        
        if action_type == "message":
            return {
                "type": "message",
                "content": action["content"]
            }
            
        elif action_type == "create_file":
            return {
                "type": "file_create",
                "content": action["content"],
                "metadata": {
                    "path": action["path"],
                    "language": "solidity"
                }
            }
            
        elif action_type == "edit_file":
            return {
                "type": "code_edit",
                "content": action["edit"]["replace"],
                "metadata": {
                    "path": action["path"],
                    "language": "solidity"
                }
            }
            
        elif action_type == "delete_file":
            return {
                "type": "file_delete",
                "content": "",
                "metadata": {
                    "path": action["path"]
                }
            }
            
        return {
            "type": "error",
            "content": f"Unknown action type: {action_type}"
        } 