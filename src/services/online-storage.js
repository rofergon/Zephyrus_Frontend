import { v4 as uuidv4 } from 'uuid';

class OnlineStorage {
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

  async hasStoredPermission() {
    return true; // Siempre retorna true ya que no necesitamos permisos para IndexedDB
  }

  async requestPermission() {
    return true; // Siempre retorna true ya que no necesitamos permisos para IndexedDB
  }

  async loadDirectoryStructure() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const files = request.result;
        const structure = this.buildDirectoryStructure(files);
        resolve(structure);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  buildDirectoryStructure(files) {
    const root = [];
    const directories = new Map();

    files.forEach(file => {
      const parts = file.path.split('/');
      let currentLevel = root;
      let currentPath = '';

      parts.forEach((part, index) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        
        if (index === parts.length - 1) {
          // Es un archivo
          currentLevel.push({
            name: part,
            path: currentPath,
            type: 'file'
          });
        } else {
          // Es un directorio
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

  async createFile(path, content = '') {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const file = {
        path,
        content,
        created: new Date(),
        modified: new Date()
      };

      const request = store.put(file);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async readFile(path) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(path);

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

  async updateFile(path, content) {
    return this.createFile(path, content);
  }

  async delete(path) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(path);

      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  async rename(oldPath, newPath) {
    try {
      const content = await this.readFile(oldPath);
      await this.createFile(newPath, content);
      await this.delete(oldPath);
      return true;
    } catch (error) {
      throw new Error(`Failed to rename: ${error.message}`);
    }
  }

  async createFolder(path) {
    // En IndexedDB no necesitamos crear carpetas explícitamente
    // Las carpetas se crean implícitamente cuando se crean archivos
    return true;
  }

  destroy() {
    if (this.db) {
      this.db.close();
    }
  }
}

export const onlineStorage = new OnlineStorage(); 