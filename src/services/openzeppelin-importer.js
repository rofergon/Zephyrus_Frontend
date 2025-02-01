import { onlineStorage } from './online-storage';

class OpenZeppelinImporter {
  constructor() {
    // Usar una versión específica de OpenZeppelin para evitar problemas de compatibilidad
    this.baseUrl = 'https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/v4.9.0/contracts/';
    this.localBasePath = 'contracts/@openzeppelin/contracts/';
  }

  extractImportPaths(code) {
    // Mejorar la detección de importaciones para incluir rutas relativas y named imports
    const importRegex = /import\s+(?:{[^}]+}\s+from\s+)?["'](?:\.\.?\/|@openzeppelin\/contracts\/)(.*?\.sol)["']/g;
    const matches = [...code.matchAll(importRegex)];
    return matches.map(match => match[1]).filter(Boolean);
  }

  async importAllDependencies(importPath) {
    const dependencies = [
      // ERC721 y extensiones
      'token/ERC721/ERC721.sol',
      'token/ERC721/IERC721.sol',
      'token/ERC721/IERC721Receiver.sol',
      'token/ERC721/extensions/IERC721Metadata.sol',
      'token/ERC721/extensions/ERC721URIStorage.sol',
      'token/ERC721/extensions/ERC721Enumerable.sol',
      'token/ERC721/extensions/IERC721Enumerable.sol',
      
      // Utilidades y acceso
      'access/Ownable.sol',
      'utils/Context.sol',
      'utils/Strings.sol',
      'utils/Address.sol',
      'utils/introspection/ERC165.sol',
      'utils/introspection/IERC165.sol',
      'utils/math/Math.sol',
      'utils/math/SignedMath.sol',
      'utils/Counters.sol',
      
      // Security
      'security/Pausable.sol',
      'security/ReentrancyGuard.sol',
      
      // Interfaces
      'interfaces/IERC4906.sol',
      
      // ERC20 (por si acaso)
      'token/ERC20/ERC20.sol',
      'token/ERC20/IERC20.sol',
      'token/ERC20/extensions/IERC20Metadata.sol'
    ];

    console.log('Starting import of all dependencies...');
    
    // Limpiar los archivos existentes primero
    try {
      for (const dep of dependencies) {
        const localPath = `contracts/@openzeppelin/contracts/${dep}`;
        try {
          const exists = await this.checkLocalContract(localPath);
          if (exists) {
            console.log(`Removing existing file: ${localPath}`);
            await onlineStorage.deleteFile(localPath);
          }
        } catch (error) {
          console.log(`Error checking/deleting file ${localPath}:`, error);
        }
      }
    } catch (error) {
      console.warn('Error cleaning existing files:', error);
    }

    // Importar todas las dependencias
    const results = await Promise.allSettled(dependencies.map(async (dep) => {
      try {
        console.log(`Importing dependency: ${dep}`);
        const result = await this.importContract(dep);
        if (result) {
          console.log(`Successfully imported: ${dep}`);
        }
        return result;
      } catch (error) {
        console.error(`Error importing ${dep}:`, error);
        throw error;
      }
    }));
    
    // Verificar resultados
    const failed = results.filter(r => r.status === 'rejected').map((r, i) => dependencies[i]);
    if (failed.length > 0) {
      console.error('Failed to import the following dependencies:', failed);
      throw new Error(`Failed to import ${failed.length} dependencies: ${failed.join(', ')}`);
    }

    console.log('All dependencies imported successfully');
    return true;
  }

  normalizeContractPath(path) {
    // Eliminar 'contracts/@openzeppelin/contracts/' si existe
    let normalized = path.replace(/^contracts\/@openzeppelin\/contracts\//, '');
    // Eliminar '@openzeppelin/contracts/' si existe
    normalized = normalized.replace(/^@openzeppelin\/contracts\//, '');
    return normalized;
  }

  async importContract(contractPath) {
    try {
      // Normalizar la ruta para la búsqueda en GitHub
      const normalizedPath = this.normalizeContractPath(contractPath);
      
      // Construir la ruta local completa
      const localPath = `${this.localBasePath}${normalizedPath}`;
      
      console.log('Importing contract:', {
        originalPath: contractPath,
        normalizedPath,
        localPath
      });

      // Verificar si el contrato ya existe localmente
      const exists = await this.checkLocalContract(localPath);
      if (exists) {
        console.log(`Contract ${localPath} already exists locally`);
        return true;
      }

      // Obtener el contrato de GitHub
      const githubUrl = `${this.baseUrl}${normalizedPath}`;
      console.log(`Fetching contract from:`, githubUrl);
      const response = await fetch(githubUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch contract: ${response.statusText}`);
      }
      const content = await response.text();

      // Crear directorios necesarios
      const pathParts = localPath.split('/');
      const fileName = pathParts.pop();
      const dirPath = pathParts.join('/');
      
      console.log('Creating directory structure:', dirPath);
      await this.ensureDirectoryExists(dirPath);

      // Actualizar el contenido con las rutas correctas
      const updatedContent = await this.updateDependencyImports(content);
      
      // Guardar el contrato localmente
      console.log('Writing file:', localPath);
      await onlineStorage.createFile(localPath, updatedContent);

      // Verificar que el archivo se guardó correctamente
      const savedContent = await onlineStorage.readFile(localPath);
      if (!savedContent) {
        throw new Error(`Failed to verify saved content for ${localPath}`);
      }

      console.log('Successfully imported and saved contract:', localPath);
      return true;
    } catch (error) {
      console.error(`Error importing contract ${contractPath}:`, error);
      throw error;
    }
  }

  async updateDependencyImports(content) {
    let updatedContent = content;
    
    // Actualizar la versión del pragma solidity
    updatedContent = updatedContent.replace(
      /pragma solidity \^0\.\d+\.\d+;/g,
      'pragma solidity ^0.8.20;'
    );
    
    // Función auxiliar para resolver rutas relativas
    const resolveRelativePath = (basePath, relativePath) => {
      const parts = basePath.split('/');
      parts.pop(); // Eliminar el archivo actual
      
      // Manejar '../'
      const relParts = relativePath.split('/');
      while (relParts[0] === '..') {
        parts.pop();
        relParts.shift();
      }
      
      return parts.concat(relParts).join('/');
    };
    
    // Actualizar importaciones absolutas de OpenZeppelin
    updatedContent = updatedContent.replace(
      /import\s+(?:{[^}]+}\s+from\s+)?["']@openzeppelin\/contracts\/(.*?)["']/g,
      (match, path) => {
        if (match.includes('{')) {
          return match.replace(
            /@openzeppelin\/contracts\/(.*?)["']/,
            `contracts/@openzeppelin/contracts/${path}"`
          );
        }
        return `import "contracts/@openzeppelin/contracts/${path}"`;
      }
    );
    
    // Actualizar importaciones relativas
    const currentPath = this.localBasePath;
    updatedContent = updatedContent.replace(
      /import\s+(?:{[^}]+}\s+from\s+)?["'](\.\.?\/.*?)["']/g,
      (match, path) => {
        const absolutePath = resolveRelativePath(currentPath, path);
        if (match.includes('{')) {
          return match.replace(
            /["']\.\.?\/.*?["']/,
            `"${absolutePath}"`
          );
        }
        return `import "${absolutePath}"`;
      }
    );

    // Extraer y procesar las nuevas dependencias
    const importPaths = this.extractImportPaths(content);
    if (importPaths.length > 0) {
      console.log('Found dependencies to import:', importPaths);
      await Promise.allSettled(importPaths.map(path => this.importContract(path)));
    }

    return updatedContent;
  }

  async updateCurrentContractImports(code) {
    // Actualizar las rutas de importación en el contrato actual
    let updatedCode = code;
    
    // Actualizar importaciones absolutas
    updatedCode = updatedCode.replace(
      /import\s+["']@openzeppelin\/contracts\/(.*?)["']/g,
      (match, path) => `import "contracts/@openzeppelin/contracts/${path}"`
    );
    
    // Actualizar importaciones relativas
    updatedCode = updatedCode.replace(
      /import\s+["']\.\.?\/(.*?)["']/g,
      (match, path) => {
        const absolutePath = `contracts/@openzeppelin/contracts/${path}`;
        return `import "${absolutePath}"`;
      }
    );

    // Asegurarse de que todas las dependencias estén importadas
    const importPaths = this.extractImportPaths(code);
    await Promise.allSettled(importPaths.map(path => this.importContract(path)));

    return updatedCode;
  }

  async checkLocalContract(localPath) {
    try {
      const content = await onlineStorage.readFile(localPath);
      return content !== null && content.length > 0;
    } catch {
      return false;
    }
  }

  async ensureDirectoryExists(dirPath) {
    const parts = dirPath.split('/');
    let currentPath = '';
    
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      try {
        console.log('Creating directory:', currentPath);
        await onlineStorage.createFolder(currentPath);
      } catch (error) {
        // Ignorar error si el directorio ya existe
        if (!error.message.includes('already exists')) {
          throw error;
        }
      }
    }
  }
}

export const openZeppelinImporter = new OpenZeppelinImporter(); 