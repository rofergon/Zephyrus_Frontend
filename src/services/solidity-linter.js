export const lintSolidityCode = async (code) => {
  try {
    const errors = [];
    const lines = code.split('\n');
    
    // Verificar licencia SPDX
    if (!code.includes('SPDX-License-Identifier')) {
      errors.push({
        line: 1,
        column: 1,
        severity: 1,
        message: 'SPDX license identifier not found'
      });
    }

    // Verificar versión del compilador
    if (!code.includes('pragma solidity')) {
      errors.push({
        line: 1,
        column: 1,
        severity: 2,
        message: 'Pragma statement not found'
      });
    } else {
      const pragmaLine = lines.findIndex(line => line.includes('pragma solidity'));
      if (pragmaLine > 0) {
        errors.push({
          line: pragmaLine + 1,
          column: 1,
          severity: 1,
          message: 'Pragma should be the first statement after license'
        });
      }
    }

    // Verificar nombre del contrato
    if (!code.includes('contract')) {
      errors.push({
        line: 1,
        column: 1,
        severity: 2,
        message: 'No contract definition found'
      });
    } else {
      const contractMatch = code.match(/contract\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (contractMatch && !/^[A-Z]/.test(contractMatch[1])) {
        const line = lines.findIndex(line => line.includes(contractMatch[0])) + 1;
        errors.push({
          line,
          column: 1,
          severity: 1,
          message: 'Contract name should start with a capital letter'
        });
      }
    }

    // Verificar funciones
    lines.forEach((line, index) => {
      // Verificar visibilidad de funciones
      if (line.includes('function') && !/(public|private|internal|external)/.test(line)) {
        errors.push({
          line: index + 1,
          column: 1,
          severity: 1,
          message: 'Function visibility not specified'
        });
      }

      // Verificar nombres de funciones
      const functionMatch = line.match(/function\s+([a-zA-Z_][a-zA-Z0-9_]*)/);
      if (functionMatch && /^[A-Z]/.test(functionMatch[1])) {
        errors.push({
          line: index + 1,
          column: 1,
          severity: 1,
          message: 'Function name should start with a lowercase letter'
        });
      }

      // Verificar longitud de línea
      if (line.length > 120) {
        errors.push({
          line: index + 1,
          column: 120,
          severity: 1,
          message: 'Line is too long (> 120 characters)'
        });
      }
    });

    return errors;
  } catch (error) {
    console.error('Error en el linting:', error);
    return [];
  }
};