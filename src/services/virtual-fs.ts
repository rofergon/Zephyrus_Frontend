interface FileSystemItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileSystemItem[];
}

export interface VirtualFSInstance {
  writeFile: (path: string, content: string) => Promise<void>;
  readFile: (path: string) => Promise<string>;
  getFiles: () => Promise<{ [key: string]: string }>;
  deleteFile: (path: string) => Promise<void>;
  resolveImport: (importPath: string) => Promise<{ content: string }>;
  isInitialized: () => Promise<boolean>;
  listFiles: () => Promise<FileSystemItem[]>;
  moveFile: (sourcePath: string, targetPath: string, options?: { autoRename?: boolean }) => Promise<{ newPath: string; renamed: boolean }>;
  moveDirectory: (sourcePath: string, targetPath: string, options?: { autoRename?: boolean }) => Promise<{ newPath: string; renamed: boolean }>;
  exists: (path: string) => Promise<boolean>;
  clear: () => Promise<void>;
}

class VirtualFileSystem implements VirtualFSInstance {
  private static instance: VirtualFileSystem;
  private db: IDBDatabase | null = null;
  private dbName = 'virtualFS';
  private version = 1;
  private initPromise: Promise<void>;
  private initialized = false;

  private constructor() {
    this.initPromise = this.initDB().then(() => {
      this.initialized = true;
    }).catch(error => {
      console.error('Failed to initialize database:', error);
      throw error;
    });
  }

  public static getInstance(): VirtualFileSystem {
    if (!VirtualFileSystem.instance) {
      VirtualFileSystem.instance = new VirtualFileSystem();
    }
    return VirtualFileSystem.instance;
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Error opening virtual file system database'));
      };

      request.onsuccess = async () => {
        this.db = request.result;
        try {
          await this.ensureDirectory('contracts');
        } catch (error) {
          console.error('Error creating contracts directory:', error);
        }
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'path' });
        }
      };
    });
  }

  private async ensureDirectory(path: string): Promise<void> {
    try {
      await this.readFile(`${path}/.gitkeep`);
    } catch {
      // Si el archivo no existe, crear el directorio
      await this.writeFile(`${path}/.gitkeep`, '');
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.initPromise;
    }
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/');
  }

  public async writeFile(path: string, content: string): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.put({
        path: this.normalizePath(path),
        content
      });

      request.onerror = () => {
        reject(new Error(`Error writing file: ${path}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  public async readFile(path: string): Promise<string> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      const transaction = this.db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      const request = store.get(this.normalizePath(path));

      request.onerror = () => {
        reject(new Error(`Error reading file: ${path}`));
      };

      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result.content);
        } else {
          reject(new Error(`File not found: ${path}`));
        }
      };
    });
  }

  public async getFiles(): Promise<{ [key: string]: string }> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      const request = this.db
        .transaction(['files'], 'readonly')
        .objectStore('files')
        .getAll();

      request.onerror = () => {
        reject(new Error('Error getting files from virtual file system'));
      };

      request.onsuccess = () => {
        const files: { [key: string]: string } = {};
        request.result.forEach((file: { path: string; content: string }) => {
          files[file.path] = file.content;
        });
        resolve(files);
      };
    });
  }

  public async deleteFile(path: string): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.delete(this.normalizePath(path));

      request.onerror = () => {
        reject(new Error(`Error deleting file: ${path}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  public async resolveImport(importPath: string): Promise<{ content: string }> {
    await this.ensureInitialized();
    try {
      const content = await this.readFile(importPath);
      return { content };
    } catch (error) {
      throw new Error(`Unable to resolve import: ${importPath}`);
    }
  }

  public async isInitialized(): Promise<boolean> {
    if (!this.db) {
      await this.initPromise;
    }
    return this.initialized;
  }

  public async listFiles(): Promise<FileSystemItem[]> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const request = this.db
        .transaction(['files'], 'readonly')
        .objectStore('files')
        .getAll();

      request.onerror = () => {
        reject(new Error('Error listing files'));
      };

      request.onsuccess = () => {
        const files = request.result;
        const fileSystem: { [key: string]: FileSystemItem } = {};

        // Primero, crear todos los directorios necesarios
        files.forEach((file: { path: string; content: string }) => {
          const parts = file.path.split('/');
          let currentPath = '';

          // Crear todos los directorios en la ruta
          for (let i = 0; i < parts.length - 1; i++) {
            const part = parts[i];
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!fileSystem[currentPath]) {
              fileSystem[currentPath] = {
                name: part,
                path: currentPath,
                type: 'directory',
                children: []
              };
            }
          }

          // Añadir el archivo
          const fileName = parts[parts.length - 1];
          const filePath = file.path;
          
          // No añadir archivos .gitkeep
          if (fileName !== '.gitkeep') {
            fileSystem[filePath] = {
              name: fileName,
              path: filePath,
              type: 'file'
            };

            // Añadir el archivo como hijo del directorio padre
            const parentPath = parts.slice(0, -1).join('/');
            if (parentPath && fileSystem[parentPath]) {
              fileSystem[parentPath].children = fileSystem[parentPath].children || [];
              fileSystem[parentPath].children.push(fileSystem[filePath]);
            }
          }
        });

        // Construir la jerarquía conectando los directorios
        Object.values(fileSystem).forEach(item => {
          if (item.type === 'directory') {
            const parentPath = item.path.split('/').slice(0, -1).join('/');
            if (parentPath && fileSystem[parentPath]) {
              fileSystem[parentPath].children = fileSystem[parentPath].children || [];
              if (!fileSystem[parentPath].children.some(child => child.path === item.path)) {
                fileSystem[parentPath].children.push(item);
              }
            }
          }
        });

        // Obtener solo los elementos raíz
        const rootItems = Object.values(fileSystem).filter(item => {
          const parentPath = item.path.split('/').slice(0, -1).join('/');
          return !parentPath || !fileSystem[parentPath];
        });

        // Ordenar: primero directorios, luego archivos, ambos alfabéticamente
        const sortItems = (items: FileSystemItem[]) => {
          items.sort((a, b) => {
            if (a.type === b.type) {
              return a.name.localeCompare(b.name);
            }
            return a.type === 'directory' ? -1 : 1;
          });

          items.forEach(item => {
            if (item.children) {
              sortItems(item.children);
            }
          });

          return items;
        };

        resolve(sortItems(rootItems));
      };
    });
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      await this.readFile(path);
      return true;
    } catch {
      return false;
    }
  }

  private async generateUniquePath(basePath: string): Promise<string> {
    let path = basePath;
    let counter = 1;
    const ext = path.includes('.') ? path.substring(path.lastIndexOf('.')) : '';
    const base = path.includes('.') ? path.substring(0, path.lastIndexOf('.')) : path;

    while (await this.fileExists(path)) {
      path = `${base}_${counter}${ext}`;
      counter++;
    }

    return path;
  }

  public async moveFile(
    sourcePath: string, 
    targetPath: string, 
    options: { autoRename?: boolean } = {}
  ): Promise<{ newPath: string; renamed: boolean }> {
    await this.ensureInitialized();
    
    try {
      const content = await this.readFile(sourcePath);
      let finalPath = targetPath;
      let renamed = false;

      if (await this.fileExists(targetPath)) {
        if (options.autoRename) {
          finalPath = await this.generateUniquePath(targetPath);
          renamed = true;
        } else {
          throw new Error('File already exists at target path');
        }
      }

      await this.writeFile(finalPath, content);
      await this.deleteFile(sourcePath);

      return { newPath: finalPath, renamed };
    } catch (error) {
      throw new Error(`Error moving file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async moveDirectory(
    sourcePath: string, 
    targetPath: string, 
    options: { autoRename?: boolean } = {}
  ): Promise<{ newPath: string; renamed: boolean }> {
    await this.ensureInitialized();
    
    try {
      const files = await this.getFiles();
      let finalPath = targetPath;
      let renamed = false;

      // Verificar si el directorio destino ya existe
      const targetExists = Object.keys(files).some(path => 
        path.startsWith(targetPath + '/') || path === targetPath
      );

      if (targetExists) {
        if (options.autoRename) {
          finalPath = await this.generateUniquePath(targetPath);
          renamed = true;
        } else {
          throw new Error('Directory already exists at target path');
        }
      }

      // Mover todos los archivos del directorio
      for (const [path, content] of Object.entries(files)) {
        if (path.startsWith(sourcePath + '/') || path === sourcePath) {
          const relativePath = path.slice(sourcePath.length);
          const newPath = finalPath + relativePath;
          await this.writeFile(newPath, content);
          await this.deleteFile(path);
        }
      }

      return { newPath: finalPath, renamed };
    } catch (error) {
      throw new Error(`Error moving directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  public async exists(path: string): Promise<boolean> {
    await this.ensureInitialized();
    return await this.fileExists(path);
  }

  public async clear(): Promise<void> {
    await this.ensureInitialized();
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      const request = store.clear();

      request.onerror = () => {
        reject(new Error('Error clearing virtual file system'));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }
}

// Crear una instancia y asegurarse de que está inicializada antes de exportarla
const instance = VirtualFileSystem.getInstance();

// Exportar la instancia tipada
export const virtualFS: VirtualFSInstance = instance; 