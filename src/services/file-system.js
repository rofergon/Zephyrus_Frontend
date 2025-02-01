import { v4 as uuidv4 } from 'uuid';

class FileSystem {
  constructor() {
    this.rootDirectory = null;
    this.fileHandles = new Map();
    this.loadFromLocalStorage();
    this.watchInterval = null;
  }

  async requestPermission() {
    try {
      this.rootDirectory = await window.showDirectoryPicker({
        mode: 'readwrite'
      });
      
      // Iniciar el observador de cambios
      this.startWatching();
      
      return true;
    } catch (error) {
      console.error('Error requesting directory permission:', error);
      return false;
    }
  }

  startWatching() {
    // Detener el observador anterior si existe
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
    }

    // Crear un nuevo observador que verifica cambios cada 2 segundos
    this.watchInterval = setInterval(async () => {
      if (this.rootDirectory) {
        await this.loadDirectoryStructure();
      }
    }, 2000);
  }

  async loadDirectoryStructure() {
    if (!this.rootDirectory) {
      throw new Error('No root directory selected');
    }

    try {
      const structure = await this.scanDirectory(this.rootDirectory);
      this.saveToLocalStorage();
      return structure;
    } catch (error) {
      console.error('Error loading directory structure:', error);
      throw error;
    }
  }

  async scanDirectory(dirHandle, path = '') {
    const entries = [];
    for await (const entry of dirHandle.values()) {
      const entryPath = path ? `${path}/${entry.name}` : entry.name;
      
      if (entry.kind === 'file') {
        this.fileHandles.set(entryPath, entry);
        entries.push({
          name: entry.name,
          path: entryPath,
          type: 'file'
        });
      } else if (entry.kind === 'directory') {
        const subEntries = await this.scanDirectory(entry, entryPath);
        entries.push({
          name: entry.name,
          path: entryPath,
          type: 'directory',
          children: subEntries
        });
      }
    }
    return entries;
  }

  async createFile(path, content = '') {
    if (!this.rootDirectory) {
      throw new Error('No root directory selected');
    }

    const parts = path.split('/');
    const fileName = parts.pop();
    let currentDir = this.rootDirectory;

    // Navegar/crear la estructura de directorios
    for (const part of parts) {
      try {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
      } catch (error) {
        throw new Error(`Failed to create directory ${part}: ${error.message}`);
      }
    }

    try {
      const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      this.fileHandles.set(path, fileHandle);
      await this.loadDirectoryStructure();
      return true;
    } catch (error) {
      throw new Error(`Failed to create file ${fileName}: ${error.message}`);
    }
  }

  async writeFile(path, content) {
    if (!this.rootDirectory) {
      throw new Error('No root directory selected');
    }

    try {
      const fileHandle = await this.getFileHandle(path, true);
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch (error) {
      throw new Error(`Failed to write to file ${path}: ${error.message}`);
    }
  }

  async readFile(path) {
    if (!this.rootDirectory) {
      throw new Error('No root directory selected');
    }

    try {
      const fileHandle = await this.getFileHandle(path);
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (error) {
      throw new Error(`Failed to read file ${path}: ${error.message}`);
    }
  }

  async createFolder(path) {
    if (!this.rootDirectory) {
      throw new Error('No root directory selected');
    }

    const parts = path.split('/');
    let currentDir = this.rootDirectory;

    for (const part of parts) {
      try {
        currentDir = await currentDir.getDirectoryHandle(part, { create: true });
      } catch (error) {
        throw new Error(`Failed to create directory ${part}: ${error.message}`);
      }
    }

    await this.loadDirectoryStructure();
    return true;
  }

  async getFileHandle(path, create = false) {
    const parts = path.split('/');
    const fileName = parts.pop();
    let currentDir = this.rootDirectory;

    for (const part of parts) {
      try {
        currentDir = await currentDir.getDirectoryHandle(part, { create });
      } catch (error) {
        throw new Error(`Directory not found: ${part}`);
      }
    }

    try {
      return await currentDir.getFileHandle(fileName, { create });
    } catch (error) {
      throw new Error(`File not found: ${fileName}`);
    }
  }

  loadFromLocalStorage() {
    try {
      const savedState = localStorage.getItem('fileSystem');
      if (savedState) {
        const { rootPath } = JSON.parse(savedState);
        // Solo restaurar la ruta del directorio raíz
        this.rootPath = rootPath;
      }
    } catch (error) {
      console.error('Error loading file system state:', error);
    }
  }

  saveToLocalStorage() {
    try {
      const state = {
        rootPath: this.rootDirectory?.name || null
      };
      localStorage.setItem('fileSystem', JSON.stringify(state));
    } catch (error) {
      console.error('Error saving file system state:', error);
    }
  }

  stripHandles(structure) {
    return structure.map(item => {
      const stripped = { ...item };
      delete stripped.handle;
      if (stripped.children) {
        stripped.children = this.stripHandles(stripped.children);
      }
      return stripped;
    });
  }

  getFiles() {
    return this.fileHandles;
  }

  async updateFile(path, content) {
    try {
      const pathParts = path.split('/');
      const fileName = pathParts.pop();
      let currentDir = this.rootDirectory;
      
      // Navegar a la carpeta correcta
      for (const part of pathParts) {
        if (part) {
          currentDir = await currentDir.getDirectoryHandle(part);
        }
      }
      
      // Actualizar el archivo
      const fileHandle = await currentDir.getFileHandle(fileName);
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      
      // Actualizar la estructura en memoria
      await this.loadDirectoryStructure();
      
      return true;
    } catch (error) {
      console.error('Error updating file:', error);
      throw error;
    }
  }

  async delete(path) {
    try {
      const pathParts = path.split('/');
      const name = pathParts.pop();
      let currentDir = this.rootDirectory;
      
      // Navegar a la carpeta correcta
      for (const part of pathParts) {
        if (part) {
          currentDir = await currentDir.getDirectoryHandle(part);
        }
      }
      
      // Eliminar el archivo o carpeta
      await currentDir.removeEntry(name, { recursive: true });
      
      // Actualizar la estructura en memoria
      await this.loadDirectoryStructure();
      
      return true;
    } catch (error) {
      console.error('Error deleting item:', error);
      throw error;
    }
  }

  async rename(oldPath, newName) {
    try {
      // Primero leemos el contenido si es un archivo
      let content = '';
      const isFile = await this.isFile(oldPath);
      if (isFile) {
        content = await this.readFile(oldPath);
      }
      
      // Obtenemos la ruta del nuevo archivo/carpeta
      const pathParts = oldPath.split('/');
      pathParts.pop();
      const newPath = [...pathParts, newName].join('/');
      
      // Creamos el nuevo archivo/carpeta
      if (isFile) {
        await this.createFile(newPath, content);
      } else {
        await this.createFolder(newPath);
      }
      
      // Eliminamos el original
      await this.delete(oldPath);
      
      return true;
    } catch (error) {
      console.error('Error renaming item:', error);
      throw error;
    }
  }

  async isFile(path) {
    try {
      const pathParts = path.split('/');
      const name = pathParts.pop();
      let currentDir = this.rootDirectory;
      
      for (const part of pathParts) {
        if (part) {
          currentDir = await currentDir.getDirectoryHandle(part);
        }
      }
      
      try {
        await currentDir.getFileHandle(name);
        return true;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  // Método para verificar si una carpeta existe
  async directoryExists(path) {
    try {
      const parts = path.split('/');
      let currentDir = this.rootDirectory;

      for (const part of parts) {
        currentDir = await currentDir.getDirectoryHandle(part);
      }
      return true;
    } catch {
      return false;
    }
  }

  // Método para obtener la ruta del directorio raíz
  getRootPath() {
    return this.rootDirectory?.name || null;
  }

  // Limpiar el observador cuando se destruye la instancia
  destroy() {
    if (this.watchInterval) {
      clearInterval(this.watchInterval);
    }
  }
}

export const fileSystem = new FileSystem(); 