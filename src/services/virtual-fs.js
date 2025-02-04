import { v4 as uuidv4 } from 'uuid';

class VirtualFileSystem {
  constructor() {
    this.db = null;
    this.dbName = 'zephyrusFiles';
    this.storeName = 'files';
    this.init();
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => {
        console.error("Error opening database");
        reject(request.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'path' });
        }
      };
    });
  }

  // Normaliza una ruta eliminando elementos redundantes y resolviendo rutas relativas
  normalizePath(path) {
    // Eliminar './' del inicio
    path = path.replace(/^\.\//, '');
    
    // Dividir la ruta en partes
    const parts = path.split('/');
    const stack = [];
    
    for (const part of parts) {
      if (part === '.' || part === '') continue;
      if (part === '..') {
        stack.pop();
      } else {
        stack.push(part);
      }
    }
    
    return stack.join('/');
  }

  // Resuelve una ruta relativa desde una ruta base
  resolvePath(basePath, relativePath) {
    // Si es una ruta absoluta, retornarla normalizada
    if (relativePath.startsWith('/')) {
      return this.normalizePath(relativePath.slice(1));
    }

    // Si es una importación de OpenZeppelin, normalizarla
    if (relativePath.startsWith('@openzeppelin/')) {
      return this.normalizePath(`contracts/${relativePath}`);
    }

    // Obtener el directorio base
    const baseDir = basePath.split('/').slice(0, -1).join('/');
    
    // Combinar las rutas y normalizar
    const combinedPath = baseDir ? `${baseDir}/${relativePath}` : relativePath;
    return this.normalizePath(combinedPath);
  }

  // Busca un archivo en múltiples ubicaciones
  async resolveImport(importPath, fromPath = '') {
    console.log(`[VFS] Resolving import: ${importPath} from ${fromPath}`);
    
    // Lista de rutas a intentar
    const pathsToTry = [];
    
    // Si es una ruta relativa
    if (importPath.startsWith('.')) {
      // Si tenemos una ruta base (fromPath), resolver relativo a ella
      if (fromPath) {
        const baseDir = fromPath.split('/').slice(0, -1).join('/');
        pathsToTry.push(this.normalizePath(`${baseDir}/${importPath}`));
      }
      // Intentar desde la raíz
      pathsToTry.push(
        this.normalizePath(importPath.replace(/^\.\//, '')),
        this.normalizePath(`contracts/${importPath.replace(/^\.\//, '')}`)
      );
    }
    // Si es una ruta absoluta
    else if (importPath.startsWith('/')) {
      pathsToTry.push(
        this.normalizePath(importPath.slice(1)),
        this.normalizePath(`contracts/${importPath.slice(1)}`)
      );
    }
    // Si es una importación de node_modules
    else if (importPath.startsWith('@')) {
      pathsToTry.push(
        this.normalizePath(`contracts/${importPath}`),
        this.normalizePath(`node_modules/${importPath}`)
      );
    }
    // Si es una importación local sin ./ o ../
    else {
      // Primero intentar en el mismo directorio si hay fromPath
      if (fromPath) {
        const baseDir = fromPath.split('/').slice(0, -1).join('/');
        pathsToTry.push(this.normalizePath(`${baseDir}/${importPath}`));
      }
      pathsToTry.push(
        this.normalizePath(importPath),
        this.normalizePath(`contracts/${importPath}`)
      );
    }

    console.log('[VFS] Trying paths:', pathsToTry);

    // Intentar cada ruta
    for (const path of pathsToTry) {
      try {
        const content = await this.readFile(path);
        if (content !== null) {
          console.log(`[VFS] Found file at: ${path}`);
          return { path, content };
        }
      } catch (error) {
        console.log(`[VFS] File not found at: ${path}`);
      }
    }

    // Si no se encuentra, intentar buscar en node_modules remotos solo si es una importación de @openzeppelin
    if (importPath.startsWith('@openzeppelin/')) {
      try {
        const content = await this.fetchFromNodeModules(importPath);
        if (content) {
          const path = `node_modules/${importPath}`;
          await this.writeFile(path, content);
          return { path, content };
        }
      } catch (error) {
        console.log(`[VFS] Failed to fetch from node_modules: ${error.message}`);
      }
    }

    // Si no se encuentra el archivo, devolver un error más descriptivo
    const triedPaths = pathsToTry.join('\n  - ');
    throw new Error(`Could not resolve import: ${importPath}\nTried the following paths:\n  - ${triedPaths}`);
  }

  async fetchFromNodeModules(path) {
    // Remover @openzeppelin/contracts/ del inicio si existe
    const normalizedPath = path.replace(/^@openzeppelin\/contracts\//, '');
    
    const url = `https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-contracts/v4.9.0/contracts/${normalizedPath}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    
    return await response.text();
  }

  async readFile(path) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(this.normalizePath(path));

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.content);
        } else {
          reject(new Error(`File not found: ${path}`));
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async writeFile(path, content) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const normalizedPath = this.normalizePath(path);
      
      const file = {
        path: normalizedPath,
        content,
        created: new Date(),
        modified: new Date()
      };

      const request = store.put(file);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async delete(path) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Obtener todos los archivos para encontrar los que están dentro de la carpeta
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = async () => {
        const files = getAllRequest.result;
        const normalizedPath = this.normalizePath(path);
        
        // Encontrar todos los archivos que comienzan con la ruta de la carpeta
        const filesToDelete = files.filter(file => 
          file.path === normalizedPath || // el archivo/carpeta exacto
          (file.path.startsWith(normalizedPath + '/') && file.path.split('/').length === normalizedPath.split('/').length + 1) // solo los archivos directamente dentro de la carpeta
        );
        
        try {
          // Eliminar cada archivo encontrado
          for (const file of filesToDelete) {
            await new Promise((res, rej) => {
              const deleteRequest = store.delete(file.path);
              deleteRequest.onsuccess = () => res();
              deleteRequest.onerror = () => rej(deleteRequest.error);
            });
          }
          resolve(true);
        } catch (error) {
          reject(error);
        }
      };
      
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  async fileExists(path) {
    return new Promise((resolve) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(this.normalizePath(path));

      request.onsuccess = () => {
        resolve(!!request.result);
      };
      request.onerror = () => resolve(false);
    });
  }

  generateUniqueName(basePath, originalName) {
    const ext = originalName.includes('.') ? 
      '.' + originalName.split('.').pop() : '';
    const nameWithoutExt = originalName.replace(ext, '');
    let counter = 1;
    let newName = originalName;
    let newPath = basePath ? `${basePath}/${newName}` : newName;

    return {
      async getUniqueName() {
        while (await this.fileExists(newPath)) {
          newName = `${nameWithoutExt} (${counter})${ext}`;
          newPath = basePath ? `${basePath}/${newName}` : newName;
          counter++;
        }
        return { newName, newPath };
      }
    };
  }

  async moveFile(sourcePath, targetPath, options = {}) {
    const { overwrite = false, autoRename = true } = options;
    
    try {
      const normalizedSourcePath = this.normalizePath(sourcePath);
      let normalizedTargetPath = this.normalizePath(targetPath);
      
      // Verificar si el archivo destino ya existe
      const targetExists = await this.fileExists(normalizedTargetPath);
      
      if (targetExists && !overwrite) {
        if (!autoRename) {
          throw new Error('FILE_EXISTS');
        }
        
        // Generar un nuevo nombre único
        const targetDir = targetPath.split('/').slice(0, -1).join('/');
        const fileName = targetPath.split('/').pop();
        const { newPath } = await this.generateUniqueName(targetDir, fileName).getUniqueName();
        normalizedTargetPath = newPath;
      }

      // Leer el contenido del archivo original
      const content = await this.readFile(normalizedSourcePath);
      
      // Escribir en la nueva ubicación
      await this.writeFile(normalizedTargetPath, content);
      
      // Eliminar el archivo original
      await this.delete(normalizedSourcePath);
      
      return {
        success: true,
        newPath: normalizedTargetPath,
        renamed: normalizedTargetPath !== this.normalizePath(targetPath)
      };
    } catch (error) {
      if (error.message === 'FILE_EXISTS') {
        throw new Error('Destination file already exists');
      }
      throw error;
    }
  }

  async moveDirectory(oldPath, newPath, options = {}) {
    const transaction = this.db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);
    
    return new Promise((resolve, reject) => {
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = async () => {
        const files = getAllRequest.result;
        const normalizedOldPath = this.normalizePath(oldPath);
        let normalizedNewPath = this.normalizePath(newPath);
        
        try {
          // Verificar si el directorio destino ya existe
          const targetExists = await this.fileExists(normalizedNewPath);
          
          if (targetExists) {
            if (!options.overwrite) {
              if (!options.autoRename) {
                throw new Error('DIRECTORY_EXISTS');
              }
              
              // Generar un nuevo nombre único para el directorio
              const targetDir = newPath.split('/').slice(0, -1).join('/');
              const dirName = newPath.split('/').pop();
              const { newPath: uniquePath } = await this.generateUniqueName(targetDir, dirName).getUniqueName();
              normalizedNewPath = uniquePath;
            }
          }

          // Encontrar todos los archivos que necesitan ser movidos
          const filesToMove = files.filter(file => 
            file.path === normalizedOldPath || 
            file.path.startsWith(normalizedOldPath + '/')
          );

          const movedFiles = [];
          
          // Mover cada archivo a su nueva ubicación
          for (const file of filesToMove) {
            const relativePath = file.path.slice(normalizedOldPath.length);
            const newFilePath = normalizedNewPath + (relativePath || '');
            
            try {
              // Intentar mover el archivo con manejo de duplicados
              const result = await this.moveFile(file.path, newFilePath, {
                ...options,
                autoRename: true // Siempre auto-renombrar archivos dentro de carpetas
              });
              
              movedFiles.push({
                oldPath: file.path,
                newPath: result.newPath,
                renamed: result.renamed
              });
            } catch (error) {
              console.error(`Error moving file ${file.path}:`, error);
              // Continuar con el siguiente archivo
            }
          }
          
          resolve({
            success: true,
            newPath: normalizedNewPath,
            renamed: normalizedNewPath !== this.normalizePath(newPath),
            movedFiles
          });
        } catch (error) {
          if (error.message === 'DIRECTORY_EXISTS') {
            reject(new Error('Destination directory already exists'));
          } else {
            reject(error);
          }
        }
      };
      
      getAllRequest.onerror = () => reject(getAllRequest.error);
    });
  }

  async rename(oldPath, newPath) {
    try {
      const content = await this.readFile(oldPath);
      await this.writeFile(newPath, content);
      await this.delete(oldPath);
      return true;
    } catch (error) {
      throw new Error(`Failed to rename: ${error.message}`);
    }
  }

  async listFiles(directory = '') {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const files = request.result;
        const structure = this.buildDirectoryStructure(files, directory);
        resolve(structure);
      };

      request.onerror = () => reject(request.error);
    });
  }

  buildDirectoryStructure(files, baseDirectory = '') {
    const root = [];
    const directories = new Map();

    files.forEach(file => {
      // Si hay un directorio base, filtrar archivos que no estén en él
      if (baseDirectory && !file.path.startsWith(baseDirectory)) {
        return;
      }

      const relativePath = baseDirectory ? 
        file.path.slice(baseDirectory.length + 1) : 
        file.path;
      
      const parts = relativePath.split('/');
      let currentLevel = root;
      let currentPath = baseDirectory;

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (index === parts.length - 1) {
          currentLevel.push({
            name: part,
            path: currentPath,
            type: 'file'
          });
        } else {
          if (!directories.has(currentPath)) {
            const newDir = {
              name: part,
              path: currentPath,
              type: 'directory',
              children: []
            };
            currentLevel.push(newDir);
            directories.set(currentPath, newDir.children);
          }
          currentLevel = directories.get(currentPath);
        }
      });
    });

    return root;
  }

  destroy() {
    if (this.db) {
      this.db.close();
    }
  }

  readFileSync(path) {
    const normalizedPath = this.normalizePath(path);
    const transaction = this.db.transaction([this.storeName], 'readonly');
    const store = transaction.objectStore(this.storeName);
    const request = store.get(normalizedPath);
    
    let content = null;
    let error = null;
    
    request.onsuccess = (event) => {
      if (event.target.result) {
        content = event.target.result.content;
      } else {
        error = new Error(`File not found: ${path}`);
      }
    };
    
    request.onerror = (event) => {
      error = event.target.error;
    };
    
    // Wait for the request to complete
    while (content === null && error === null) {
      // Busy wait
    }
    
    if (error) {
      throw error;
    }
    
    return content;
  }
}

export const virtualFS = new VirtualFileSystem(); 