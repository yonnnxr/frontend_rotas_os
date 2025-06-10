/**
 * Serviço para gerenciar armazenamento offline usando IndexedDB
 */

const DB_NAME = 'RotasOSDB';
const DB_VERSION = 1;
export const STORES = {
  ORDERS: 'offlineOrders',
  COMPLETED_ORDERS: 'completedOrders',
  USER_DATA: 'userData'
};

/**
 * Inicializa o banco de dados IndexedDB
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Cria stores se não existirem
      if (!db.objectStoreNames.contains(STORES.ORDERS)) {
        db.createObjectStore(STORES.ORDERS, { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains(STORES.COMPLETED_ORDERS)) {
        db.createObjectStore(STORES.COMPLETED_ORDERS, { keyPath: 'id', autoIncrement: true });
      }
      
      if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
        db.createObjectStore(STORES.USER_DATA, { keyPath: 'key' });
      }
    };
    
    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };
    
    request.onerror = (event) => {
      console.error('Erro ao abrir o banco de dados:', (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

/**
 * Salva dados no IndexedDB
 */
export const saveData = async <T>(storeName: string, data: T): Promise<number> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.add(data);
    
    request.onsuccess = (event) => {
      resolve((event.target as IDBRequest).result as number);
    };
    
    request.onerror = (event) => {
      console.error(`Erro ao salvar dados em ${storeName}:`, (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
};

/**
 * Obtém todos os dados de um store
 */
export const getAllData = async <T>(storeName: string): Promise<T[]> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const store = transaction.objectStore(storeName);
    const request = store.getAll();
    
    request.onsuccess = (event) => {
      resolve((event.target as IDBRequest).result as T[]);
    };
    
    request.onerror = (event) => {
      console.error(`Erro ao obter dados de ${storeName}:`, (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
};

/**
 * Remove um item do store pelo ID
 */
export const removeData = async (storeName: string, id: number): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readwrite');
    const store = transaction.objectStore(storeName);
    const request = store.delete(id);
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      console.error(`Erro ao remover dados de ${storeName}:`, (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
};

/**
 * Salva informações do usuário
 */
export const saveUserData = async (key: string, value: any): Promise<void> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.USER_DATA, 'readwrite');
    const store = transaction.objectStore(STORES.USER_DATA);
    const request = store.put({ key, value });
    
    request.onsuccess = () => {
      resolve();
    };
    
    request.onerror = (event) => {
      console.error('Erro ao salvar dados do usuário:', (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
};

/**
 * Obtém informações do usuário
 */
export const getUserData = async (key: string): Promise<any> => {
  const db = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORES.USER_DATA, 'readonly');
    const store = transaction.objectStore(STORES.USER_DATA);
    const request = store.get(key);
    
    request.onsuccess = (event) => {
      const result = (event.target as IDBRequest).result;
      resolve(result ? result.value : null);
    };
    
    request.onerror = (event) => {
      console.error('Erro ao obter dados do usuário:', (event.target as IDBRequest).error);
      reject((event.target as IDBRequest).error);
    };
    
    transaction.oncomplete = () => {
      db.close();
    };
  });
};

/**
 * Verifica se o aplicativo está online
 */
export const isOnline = (): boolean => {
  return navigator.onLine;
};

/**
 * Registra uma ação para sincronização quando o aplicativo estiver online
 */
export const registerSyncAction = async (action: { type: string; data: any }): Promise<void> => {
  if (isOnline()) {
    // Se estiver online, tenta executar imediatamente
    try {
      // Implemente a lógica para executar a ação online
      console.log('Executando ação online:', action);
      return;
    } catch (error) {
      console.error('Erro ao executar ação online, salvando para sincronização posterior:', error);
    }
  }
  
  // Salva a ação para sincronização posterior
  await saveData(STORES.ORDERS, {
    ...action,
    timestamp: Date.now(),
    syncPending: true
  });
  
  // Registra para background sync se disponível
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    try {
      // Verificação de tipo para garantir que o 'sync' existe no registro
      if ('sync' in registration) {
        await (registration as any).sync.register('sync-orders');
      } else {
        console.log('Background Sync não suportado neste navegador');
      }
    } catch (error) {
      console.error('Erro ao registrar sincronização em background:', error);
    }
  }
};

/**
 * Tenta sincronizar todas as ações pendentes
 */
export const syncPendingActions = async (): Promise<void> => {
  if (!isOnline()) {
    console.log('Dispositivo offline, sincronização adiada');
    return;
  }
  
  try {
    const pendingActions = await getAllData<{id: number}>(STORES.ORDERS);
    
    for (const action of pendingActions) {
      try {
        // Implemente a lógica para executar a ação online
        console.log('Sincronizando ação pendente:', action);
        
        // Se bem-sucedido, remove a ação pendente
        if (action && typeof action.id === 'number') {
          await removeData(STORES.ORDERS, action.id);
        } else {
          console.warn('Ação sem ID válido, não foi possível remover:', action);
        }
      } catch (error) {
        console.error('Erro ao sincronizar ação pendente:', error);
      }
    }
  } catch (error) {
    console.error('Erro ao sincronizar ações pendentes:', error);
  }
};

// Adiciona listeners para eventos de conectividade
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('Dispositivo online. Iniciando sincronização...');
    syncPendingActions();
  });
  
  window.addEventListener('offline', () => {
    console.log('Dispositivo offline. As ações serão salvas localmente.');
  });
} 