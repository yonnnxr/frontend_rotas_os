/**
 * Ponte para APIs nativas do Cordova/Capacitor usado pelo AppMaker
 */

// Detecta se estamos rodando dentro de um ambiente nativo (Cordova/Capacitor)
window.isNativeApp = function() {
  return (
    window.cordova !== undefined || 
    window.Capacitor !== undefined || 
    document.URL.indexOf('http://') === -1 && 
    document.URL.indexOf('https://') === -1
  );
};

// Sistema de permissões nativas
window.NativePermissions = {
  // Solicita permissão de localização usando APIs nativas
  requestLocation: function() {
    return new Promise((resolve, reject) => {
      console.log("Solicitando permissão de localização via API nativa");
      
      if (!window.isNativeApp()) {
        // Se não estamos em um app nativo, usamos a API padrão do navegador
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            () => resolve(true),
            (err) => {
              console.error("Erro na API do navegador:", err);
              reject(err);
            }
          );
        } else {
          reject(new Error("Geolocalização não suportada"));
        }
        return;
      }
      
      // Tentamos diferentes APIs nativas
      
      // 1. Tentativa Cordova
      if (window.cordova && window.cordova.plugins && window.cordova.plugins.permissions) {
        const permissions = window.cordova.plugins.permissions;
        
        permissions.checkPermission("android.permission.ACCESS_FINE_LOCATION", (status) => {
          if (status.hasPermission) {
            resolve(true);
          } else {
            permissions.requestPermission("android.permission.ACCESS_FINE_LOCATION", 
              (status) => {
                if (status.hasPermission) {
                  resolve(true);
                } else {
                  reject(new Error("Permissão negada"));
                }
              }, 
              () => reject(new Error("Erro ao solicitar permissão"))
            );
          }
        }, () => reject(new Error("Erro ao verificar permissão")));
        
        return;
      }
      
      // 2. Tentativa Capacitor
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Permissions) {
        const permissions = window.Capacitor.Plugins.Permissions;
        
        permissions.query({ name: 'geolocation' })
          .then((status) => {
            if (status.state === 'granted') {
              resolve(true);
            } else if (status.state === 'prompt') {
              permissions.request({ name: 'geolocation' })
                .then((requestResult) => {
                  if (requestResult.state === 'granted') {
                    resolve(true);
                  } else {
                    reject(new Error("Permissão negada"));
                  }
                })
                .catch((err) => reject(err));
            } else {
              reject(new Error("Permissão negada"));
            }
          })
          .catch((err) => reject(err));
        
        return;
      }
      
      // 3. Fallback - WebView Android
      try {
        if (window.Android && typeof window.Android.requestLocationPermission === 'function') {
          // Interface JSBridge específica do AppMaker
          window.Android.requestLocationPermission((result) => {
            if (result === true || result === "true" || result === 1) {
              resolve(true);
            } else {
              reject(new Error("Permissão negada"));
            }
          });
          return;
        }
      } catch (e) {
        console.error("Erro ao acessar API Android:", e);
      }
      
      // Se chegamos aqui, nenhuma API nativa funcionou, tentamos o navegador como último recurso
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          (err) => reject(err)
        );
      } else {
        reject(new Error("Nenhum método de geolocalização disponível"));
      }
    });
  },
  
  // Verifica se a permissão de localização está concedida
  checkLocationPermission: function() {
    return new Promise((resolve, reject) => {
      if (!window.isNativeApp()) {
        // Se não estamos em um app nativo, retornamos o valor armazenado
        const stored = localStorage.getItem('locationPermissionGranted');
        if (stored === 'true') {
          resolve(true);
        } else {
          // Tentamos obter localização para verificar permissão
          navigator.geolocation.getCurrentPosition(
            () => {
              localStorage.setItem('locationPermissionGranted', 'true');
              resolve(true);
            },
            () => {
              localStorage.setItem('locationPermissionGranted', 'false');
              resolve(false);
            },
            { timeout: 5000 }
          );
        }
        return;
      }
      
      // Cordova
      if (window.cordova && window.cordova.plugins && window.cordova.plugins.permissions) {
        window.cordova.plugins.permissions.checkPermission(
          "android.permission.ACCESS_FINE_LOCATION",
          (status) => resolve(status.hasPermission),
          () => resolve(false)
        );
        return;
      }
      
      // Capacitor
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Permissions) {
        window.Capacitor.Plugins.Permissions.query({ name: 'geolocation' })
          .then((status) => resolve(status.state === 'granted'))
          .catch(() => resolve(false));
        return;
      }
      
      // Android WebView
      if (window.Android && typeof window.Android.checkLocationPermission === 'function') {
        try {
          const result = window.Android.checkLocationPermission();
          resolve(result === true || result === "true" || result === 1);
        } catch (e) {
          console.error("Erro ao verificar permissão:", e);
          resolve(false);
        }
        return;
      }
      
      // Fallback - assumimos que não tem permissão
      resolve(false);
    });
  },
  
  // Abre as configurações do app
  openAppSettings: function() {
    if (!window.isNativeApp()) {
      alert("Esta função só está disponível no aplicativo nativo.");
      return;
    }
    
    if (window.cordova && window.cordova.plugins && window.cordova.plugins.diagnostic) {
      window.cordova.plugins.diagnostic.switchToSettings();
      return;
    }
    
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App) {
      window.Capacitor.Plugins.App.openUrl({ url: 'app-settings:' });
      return;
    }
    
    if (window.Android && typeof window.Android.openAppSettings === 'function') {
      window.Android.openAppSettings();
      return;
    }
    
    alert("Não foi possível abrir as configurações do aplicativo.");
  }
};

// Quando o documento carregar, verificamos permissões
document.addEventListener('DOMContentLoaded', function() {
  console.log("Cordova Bridge carregada");
  
  // Aguarda o evento deviceready se estivermos em um ambiente Cordova
  if (window.isNativeApp() && window.cordova) {
    document.addEventListener('deviceready', function() {
      console.log("Cordova device ready");
      
      // Dispara um evento personalizado para informar que a ponte está pronta
      document.dispatchEvent(new CustomEvent('nativebridge:ready'));
    }, false);
  } else {
    // Se não estivermos em um ambiente Cordova ou se o cordova.js não estiver carregado
    // assume que a ponte está pronta
    setTimeout(function() {
      document.dispatchEvent(new CustomEvent('nativebridge:ready'));
    }, 500);
  }
});

// Exporta como global
window.CordovaBridge = {
  Permissions: window.NativePermissions
}; 