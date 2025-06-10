// Declarações de tipos globais para nossa ponte com APIs nativas

interface NativePermissions {
  requestLocation(): Promise<boolean>;
  checkLocationPermission(): Promise<boolean>;
  openAppSettings(): void;
}

interface CordovaBridge {
  Permissions: NativePermissions;
}

declare global {
  interface Window {
    // Ponte para APIs nativas
    isNativeApp?: () => boolean;
    CordovaBridge?: CordovaBridge;
    NativePermissions?: NativePermissions;
    
    // Interfaces nativas potenciais
    cordova?: any;
    Capacitor?: any;
    Android?: {
      requestLocationPermission?: (callback: (result: boolean | string | number) => void) => void;
      checkLocationPermission?: () => boolean | string | number;
      openAppSettings?: () => void;
    };
    
    // Variáveis de controle
    ultimaAtualizacaoRota?: number;
  }
}

export {}; 