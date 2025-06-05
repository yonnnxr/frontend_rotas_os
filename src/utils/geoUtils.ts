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
  ordensAtendidas: string[],
  statusOrdens: Record<string, string> = {}
): OSPoint | null => {
  if (!userLocation || todasOrdens.length === 0) {
    console.log("Sem localização do usuário ou lista de ordens vazia");
    return null;
  }
  
  console.log(`Buscando próxima OS - total ordens: ${todasOrdens.length}, atendidas: ${ordensAtendidas.length}, com status interno: ${Object.keys(statusOrdens).length}`);
  
  // Filtra ordens que ainda não foram atendidas e que não estão marcadas como concluídas no app
  const ordensNaoAtendidas = todasOrdens.filter(os => {
    // Verificações de segurança
    if (!os || !os.id) {
      console.warn("Ordem inválida encontrada na lista:", os);
      return false;
    }
    
    // Verifica se a ordem não está na lista de atendidas
    const naoAtendida = !ordensAtendidas.includes(os.id);
    
    // Verifica se o status interno não é "CONCLUIDA_APP"
    const statusInternoNaoConcluido = statusOrdens[os.id] !== 'CONCLUIDA_APP';
    
    // Log detalhado para depuração
    console.log(`Verificando OS ${os.id}: naoAtendida=${naoAtendida}, statusInternoNaoConcluido=${statusInternoNaoConcluido}, status original=${os.status || 'Não definido'}`);
    
    // A ordem só é válida se ambas as condições forem verdadeiras
    return naoAtendida && statusInternoNaoConcluido;
  });
  
  console.log(`Filtrando ordens não atendidas: ${todasOrdens.length} total -> ${ordensNaoAtendidas.length} disponíveis`);
  
  // Se não houver ordens disponíveis, retorna null
  if (ordensNaoAtendidas.length === 0) {
    console.log("Nenhuma OS disponível: todas foram concluídas internamente ou estão na lista de atendidas");
    return null; // Todas as ordens foram atendidas ou estão concluídas
  }
  
  // IDs das ordens disponíveis para log
  console.log(`IDs das ordens disponíveis: ${ordensNaoAtendidas.map(os => os.id).join(', ')}`);
  
  // Calcula a distância de cada ordem até o usuário
  const ordensComDistancia = ordensNaoAtendidas.map(os => ({
    ...os,
    distanceFromUser: calcularDistancia(userLocation.lat, userLocation.lng, os.lat, os.lng)
  }));
  
  // Ordenar ordens por distância (da mais próxima para a mais distante)
  const ordensPorDistancia = [...ordensComDistancia].sort((a, b) => 
    (a.distanceFromUser || Infinity) - (b.distanceFromUser || Infinity)
  );
  
  // Log das 3 ordens mais próximas
  if (ordensPorDistancia.length > 0) {
    console.log("Ordens mais próximas (top 3):");
    ordensPorDistancia.slice(0, Math.min(3, ordensPorDistancia.length)).forEach((os, index) => {
      console.log(`${index + 1}. OS ${os.id} - Distância: ${os.distanceFromUser?.toFixed(2)}km - Status: ${os.status || 'Não definido'}`);
    });
  }
  
  // Pega a ordem mais próxima
  const osMaisProxima = ordensPorDistancia[0];
  
  if (osMaisProxima) {
    console.log(`OS mais próxima encontrada: ${osMaisProxima.id} - ${osMaisProxima.description} (Status interno: ${statusOrdens[osMaisProxima.id] || 'Não definido'})`);
    return osMaisProxima;
  } else {
    console.log("Nenhuma OS mais próxima encontrada, mesmo após filtragem");
    return null;
  }
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