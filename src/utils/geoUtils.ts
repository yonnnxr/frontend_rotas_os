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
  
  // Filtra ordens que ainda não foram atendidas e que não estão com status "Concluída"
  const ordensNaoAtendidas = todasOrdens.filter(os => {
    // Verifica se a ordem não está na lista de atendidas
    const naoAtendida = !ordensAtendidas.includes(os.id);
    
    // Verifica se o status não é "Concluída", independente de maiúsculas/minúsculas
    const statusNaoConcluido = !(os.status && 
      (os.status.toLowerCase() === 'concluída' || 
       os.status.toLowerCase() === 'concluida' ||
       os.status.toLowerCase() === 'finalizada' ||
       os.status.toLowerCase() === 'atendida'));
    
    // A ordem só é válida se ambas as condições forem verdadeiras
    return naoAtendida && statusNaoConcluido;
  });
  
  console.log(`Filtrando ordens não atendidas: ${todasOrdens.length} total -> ${ordensNaoAtendidas.length} disponíveis`);
  
  if (ordensNaoAtendidas.length === 0) {
    return null; // Todas as ordens foram atendidas ou estão concluídas
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
  
  console.log(`OS mais próxima encontrada: ${osMaisProxima.id} - ${osMaisProxima.description} (Status: ${osMaisProxima.status || 'Não definido'})`);
  
  return osMaisProxima;
};

// Função para obter a localização atual do usuário
export const obterLocalizacaoUsuario = (
  callback: (location: UserLocation) => void, 
  onError: (error: string) => void
): void => {
  // Log para debug em produção e desenvolvimento
  console.log('[GeoUtils] Iniciando solicitação de geolocalização');
  
  if (!navigator || !navigator.geolocation) {
    console.error('[GeoUtils] API de geolocalização não disponível');
    onError('Geolocalização não é suportada pelo seu navegador');
    return;
  }
  
  // Função para obter a posição com tratamento de erros robusto
  const obterPosicao = () => {
    console.log('[GeoUtils] Chamando getCurrentPosition');
    
    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 20000, // Aumentado para 20 segundos
      maximumAge: 0
    };
    
    try {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('[GeoUtils] Localização obtida com sucesso');
          const { latitude, longitude, accuracy } = position.coords;
          
          // Validação extra das coordenadas
          if (isNaN(latitude) || isNaN(longitude) || !isFinite(latitude) || !isFinite(longitude)) {
            console.error('[GeoUtils] Coordenadas inválidas recebidas', { latitude, longitude });
            onError('Coordenadas de localização inválidas recebidas do dispositivo');
            return;
          }
          
          callback({
            lat: latitude,
            lng: longitude,
            accuracy: accuracy || 0
          });
        },
        (error) => {
          console.error('[GeoUtils] Erro ao obter localização:', error);
          
          // Mensagens de erro mais amigáveis
          let mensagem = 'Não foi possível obter sua localização.';
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              mensagem = 'Permissão de localização negada. Por favor, ative a localização nas configurações do seu navegador e recarregue a página.';
              break;
            case error.POSITION_UNAVAILABLE:
              mensagem = 'Informações de localização indisponíveis. Verifique se o GPS do dispositivo está ativado.';
              break;
            case error.TIMEOUT:
              mensagem = 'A solicitação de localização expirou. Verifique sua conexão de internet e tente novamente.';
              break;
          }
          
          onError(mensagem);
        },
        geoOptions
      );
    } catch (e) {
      console.error('[GeoUtils] Exceção ao solicitar geolocalização:', e);
      onError('Erro inesperado ao solicitar localização. Por favor, recarregue a página e tente novamente.');
    }
  };
  
  // Estratégia melhorada para verificar permissões
  if ('permissions' in navigator && navigator.permissions && navigator.permissions.query) {
    try {
      console.log('[GeoUtils] Verificando permissões via API de Permissions');
      
      navigator.permissions.query({ name: 'geolocation' as PermissionName })
        .then(permissionStatus => {
          console.log('[GeoUtils] Estado da permissão:', permissionStatus.state);
          
          if (permissionStatus.state === 'denied') {
            onError('Permissão de localização negada pelo navegador. Por favor, ative a localização nas configurações do seu navegador e recarregue a página.');
            return;
          }
          
          // Mesmo se for "prompt", vamos tentar obter a localização
          obterPosicao();
          
          // Configura listener para mudanças no estado da permissão
          permissionStatus.addEventListener('change', function() {
            console.log('[GeoUtils] Estado da permissão alterado para:', this.state);
            if (this.state === 'granted') {
              // Se o usuário acabou de conceder a permissão, tenta novamente
              obterPosicao();
            }
          });
        })
        .catch(err => {
          console.error('[GeoUtils] Erro ao verificar permissões:', err);
          // Se falhar a verificação de permissão, tenta obter a localização diretamente
          obterPosicao();
        });
    } catch (e) {
      console.error('[GeoUtils] Exceção ao verificar permissões:', e);
      // Se houver qualquer erro na API de permissões, tenta obter a localização diretamente
      obterPosicao();
    }
  } else {
    console.log('[GeoUtils] API de Permissions não disponível, solicitando localização diretamente');
    // Se a API de permissões não estiver disponível, tenta obter a localização diretamente
    obterPosicao();
  }
};

// Correção para coordenadas de Anastácio
export const corrigirCoordenadas = (lng: number, lat: number) => {
  return {
    lat,
    lng: lng - 12 // Correção específica para Anastácio
  };
}; 