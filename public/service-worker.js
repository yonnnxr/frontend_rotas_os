const CACHE_NAME = 'rotas-os-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/index.css',
  '/assets/index.js',
  '/icons/icon.png',
  '/icons/adaptive-icon.png',
  '/icons/splash.png',
  '/offline.html',
  // Adicione aqui outros arquivos importantes
];

// Instalação do Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
});

// Estratégia de cache: Cache primeiro, depois rede
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - retorna a resposta do cache
        if (response) {
          return response;
        }

        // Clone a requisição
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          response => {
            // Verifica se recebemos uma resposta válida
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone a resposta
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // Adiciona requisição ao cache
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        ).catch(() => {
          // Se falhar e for uma requisição de imagem, retorna uma imagem padrão
          if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
            return caches.match('/icons/icon.png');
          }
          // Para outros recursos, mostra um erro offline
          return caches.match('/offline.html');
        });
      })
  );
});

// Atualização do Service Worker
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            // Remove caches antigas
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Gerenciamento de mensagens para sincronização offline
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Background sync para operações quando estiver offline
self.addEventListener('sync', event => {
  if (event.tag === 'sync-orders') {
    event.waitUntil(syncOrders());
  }
});

// Função para sincronizar ordens offline
async function syncOrders() {
  try {
    // Recupera dados do IndexedDB
    const db = await openDatabase();
    const offlineOrders = await getOfflineOrders(db);
    
    if (offlineOrders.length > 0) {
      // Envia cada ordem para o servidor
      for (const order of offlineOrders) {
        await fetch('/api/orders/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${order.token}`
          },
          body: JSON.stringify(order.data)
        });
        
        // Remove a ordem sincronizada
        await removeOfflineOrder(db, order.id);
      }
    }
  } catch (error) {
    console.error('Erro ao sincronizar ordens:', error);
  }
}

// Funções auxiliares para IndexedDB
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('RotasOSDB', 1);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('offlineOrders')) {
        db.createObjectStore('offlineOrders', { keyPath: 'id', autoIncrement: true });
      }
    };
    
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}

function getOfflineOrders(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offlineOrders'], 'readonly');
    const store = transaction.objectStore('offlineOrders');
    const request = store.getAll();
    
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}

function removeOfflineOrder(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['offlineOrders'], 'readwrite');
    const store = transaction.objectStore('offlineOrders');
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = event => reject(event.target.error);
  });
} 