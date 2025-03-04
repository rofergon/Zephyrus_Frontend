import logging
from typing import List, Dict
from anthropic import AsyncAnthropic

logger = logging.getLogger(__name__)

class CompilationActions:
    def __init__(self, anthropic_client: AsyncAnthropic, file_manager):
        self.anthropic = anthropic_client
        self.file_manager = file_manager
        self.max_compilation_attempts = 5

    async def fix_compilation_errors(self, file_path: str, errors: List[Dict]) -> bool:
        """Intenta corregir errores de compilación automáticamente."""
        attempts = 0
        while attempts < self.max_compilation_attempts:
            try:
                # Obtener el contenido actual
                content = await self.file_manager.read_file(file_path)
                
                # Crear un mensaje para Claude con los errores
                error_message = "Fix the following Solidity compilation errors:\n"
                for error in errors:
                    error_message += f"Line {error['line']}: {error['message']}\n"
                error_message += f"\nCurrent code:\n```solidity\n{content}\n```"

                # Obtener la solución de Claude
                response = await self.anthropic.messages.create(
                    model="claude-3-sonnet-20240229",
                    max_tokens=4096,
                    system="You are a Solidity expert. Fix the compilation errors in the contract.",
                    messages=[
                        {"role": "user", "content": error_message}
                    ],
                    temperature=0.3
                )

                # Extraer el código corregido
                fixed_code = self.extract_solidity_code(response.content[0].text)
                if fixed_code:
                    # Aplicar la corrección
                    await self.file_manager.write_file(file_path, fixed_code)
                    
                    # Verificar si se resolvieron los errores
                    new_result = await self.file_manager.compile_solidity(file_path)
                    if new_result["success"]:
                        return True
                
                attempts += 1
            except Exception as e:
                logger.error(f"Error fixing compilation errors: {str(e)}")
                break

        return False

    def extract_solidity_code(self, text: str) -> str:
        """Extrae el código Solidity de una respuesta de texto."""
        start = text.find("```solidity")
        if start == -1:
            start = text.find("```")
        if start == -1:
            return ""
        
        end = text.find("```", start + 3)
        if end == -1:
            return ""
        
        code = text[start:end].strip()
        code = code.replace("```solidity", "").replace("```", "").strip()
        return code 