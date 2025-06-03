import { OSPoint, UserLocation } from '../types';

// Função para calcular a distância entre dois pontos (em km)
export const calcularDistancia = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distância em km
};

// Função para encontrar a OS mais próxima da localização atual
export const encontrarOSMaisProxima = (
  userLocation: UserLocation | null, 
  todasOrdens: OSPoint[], 
  ordensAtendidas: string[]
): OSPoint | null => {
  if (!userLocation || todasOrdens.length === 0) return null;
  
  // Filtra ordens que ainda não foram atendidas
  const ordensNaoAtendidas = todasOrdens.filter(os => !ordensAtendidas.includes(os.id));
  
  if (ordensNaoAtendidas.length === 0) {
    return null; // Todas as ordens foram atendidas
  }
  
  // Calcula a distância de cada ordem até o usuário
  const ordensComDistancia = ordensNaoAtendidas.map(os => ({
    ...os,
    distanceFromUser: calcularDistancia(userLocation.lat, userLocation.lng, os.lat, os.lng)
  }));
  
  // Encontra a ordem mais próxima
  const osMaisProxima = ordensComDistancia.reduce((prev, current) => 
    (prev.distanceFromUser || Infinity) < (current.distanceFromUser || Infinity) ? prev : current
  );
  
  return osMaisProxima;
};

// Função para obter a localização atual do usuário
export const obterLocalizacaoUsuario = (
  callback: (location: UserLocation) => void, 
  onError: (error: string) => void
): void => {
  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        callback({
          lat: latitude,
          lng: longitude,
          accuracy
        });
      },
      (error) => {
        console.error('Erro ao obter localização:', error.message);
        onError(error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  } else {
    onError('Geolocalização não é suportada pelo seu navegador');
  }
};

// Correção para coordenadas de Anastácio
export const corrigirCoordenadas = (lng: number, lat: number) => {
  return {
    lat,
    lng: lng - 12 // Correção específica para Anastácio
  };
}; 