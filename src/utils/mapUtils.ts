import L from 'leaflet';
import { GeoJSONData, OSPoint, UserLocation } from '../types';

// Abre navegação para um ponto no Google Maps
export const navegarParaGoogleMaps = (origem: { lat: number, lng: number } | null, destino: { lat: number, lng: number }) => {
  // Se não tiver origem, usa apenas o destino (o Google Maps vai usar a localização atual do dispositivo)
  const googleMapsUrl = origem
    ? `https://www.google.com/maps/dir/?api=1&origin=${origem.lat},${origem.lng}&destination=${destino.lat},${destino.lng}&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${destino.lat},${destino.lng}&travelmode=driving`;
  
  // Abre em uma nova aba
  window.open(googleMapsUrl, '_blank');
};

// Cria um marcador de usuário no mapa
export const criarMarcadorUsuario = (lat: number, lng: number): L.Marker => {
  const userIcon = L.divIcon({
    className: 'user-location-icon',
    html: `<div style="background-color:#4285F4;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.3);"></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
  
  return L.marker([lat, lng], { icon: userIcon });
};

// Função para obter rota entre dois pontos
export const obterRota = async (origem: { lat: number, lng: number }, destino: { lat: number, lng: number }) => {
  // URL da API do OSRM - Open Source Routing Machine (projeto gratuito de roteamento)
  const url = `https://router.project-osrm.org/route/v1/driving/${origem.lng},${origem.lat};${destino.lng},${destino.lat}?overview=full&geometries=geojson`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Erro ao obter rota');
    }
    
    const data = await response.json();
    
    // Verifica se a resposta contém rotas válidas
    if (!data.routes || !data.routes.length) {
      throw new Error('Nenhuma rota encontrada');
    }
    
    const route = data.routes[0];
    
    // Retorna os dados da rota em formato adequado
    return {
      distance: route.distance / 1000, // Converte para km
      duration: route.duration / 60, // Converte para minutos
      geometry: route.geometry // Geometria da rota em formato GeoJSON
    };
  } catch (error) {
    console.error('Erro ao obter rota:', error);
    return null;
  }
};

// Função para exibir rota entre a localização do usuário e uma OS no mapa
export const exibirRotaNoMapa = async (
  mapa: L.Map | null,
  rotaLayer: L.LayerGroup | null,
  origem: UserLocation | null,
  destino: OSPoint
): Promise<boolean> => {
  if (!mapa || !rotaLayer || !origem) {
    console.warn('Parâmetros inválidos para exibir rota no mapa');
    return false;
  }
  
  // Limpa rotas anteriores
  rotaLayer.clearLayers();
  
  try {
    const rotaObtida = await obterRota(
      { lat: origem.lat, lng: origem.lng },
      { lat: destino.lat, lng: destino.lng }
    );
    
    if (!rotaObtida) {
      console.warn('Não foi possível obter a rota');
      return false;
    }
    
    // Cria linha para a rota com estilo semelhante ao Google Maps
    const rotaLinha = L.geoJSON(rotaObtida.geometry, {
      style: {
        color: '#2979FF', // Azul Google Maps
        weight: 5,
        opacity: 0.8,
        lineJoin: 'round',
        lineCap: 'round'
      }
    });
    
    // Adiciona contorno branco para melhor visibilidade
    const rotaContorno = L.geoJSON(rotaObtida.geometry, {
      style: {
        color: '#FFFFFF',
        weight: 8,
        opacity: 0.5,
        lineJoin: 'round',
        lineCap: 'round'
      }
    });
    
    // Adiciona as camadas ao mapa
    rotaContorno.addTo(rotaLayer);
    rotaLinha.addTo(rotaLayer);
    
    // Ajusta o zoom para mostrar toda a rota
    mapa.fitBounds(rotaLinha.getBounds(), { padding: [50, 50] });
    
    // Mostra informações da rota
    const infoRotaElement = document.createElement('div');
    infoRotaElement.className = 'info-rota-container';
    infoRotaElement.innerHTML = `
      <div style="position:absolute;bottom:20px;left:20px;background-color:white;padding:10px;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,0.3);z-index:1000;">
        <div style="font-weight:bold;font-size:16px;">${Math.round(rotaObtida.duration)} min (${rotaObtida.distance.toFixed(1)} km)</div>
        <div style="color:#555;font-size:14px;">Rota mais rápida</div>
      </div>
    `;
    
    // Remove qualquer info de rota existente
    document.querySelectorAll('.info-rota-container').forEach(el => el.remove());
    document.body.appendChild(infoRotaElement);
    
    return true;
  } catch (error) {
    console.error('Erro ao exibir rota no mapa:', error);
    return false;
  }
};

// Função para exibir a rota visualmente (apenas visualização, sem navegação interna)
export const exibirRota = (geojsonData: GeoJSONData, routeLayer: L.LayerGroup | null): { distance: number, duration: number } => {
  // Valores padrão para retorno em caso de erro
  let totalDistance = 0;
  let totalDuration = 0;
  
  // Verificação mais robusta para validar os parâmetros de entrada
  if (!geojsonData || !geojsonData.features || !Array.isArray(geojsonData.features)) {
    console.warn("Dados GeoJSON inválidos ou ausentes");
    return { distance: 0, duration: 0 };
  }
  
  // Verifica se o routeLayer existe e está pronto para uso
  if (!routeLayer) {
    console.warn("routeLayer é null, não é possível exibir a rota");
    return { distance: 0, duration: 0 };
  }
  
  try {
    // Verifica se o clearLayers existe antes de chamá-lo
    if (typeof routeLayer.clearLayers === 'function') {
      routeLayer.clearLayers();
    } else {
      console.warn("routeLayer.clearLayers não é uma função");
      return { distance: 0, duration: 0 };
    }
    
    // Verifica se há uma rota para exibir com validação de propriedades
    const routeFeatures = geojsonData.features.filter(feature => 
      feature && 
      feature.geometry && 
      (feature.geometry.type === 'LineString' || 
      (feature.properties && 
        (feature.properties.type === 'route' || 
         feature.properties.type === 'traffic_route')))
    );
    
    if (routeFeatures.length === 0) {
      console.log("Nenhuma rota encontrada nos dados GeoJSON");
      return { distance: 0, duration: 0 };
    }
    
    // Adiciona cada rota ao mapa com tratamento de erros mais robusto
    routeFeatures.forEach(feature => {
      try {
        if (!feature || !feature.geometry) {
          console.warn("Feature inválido, pulando...");
          return;
        }
        
        const props = feature.properties || {};
        const color = props.color || '#0066CC';
        const weight = props.weight || 4;
        const opacity = props.opacity || 0.7;
        
        // Verifica se o L.geoJSON pode ser criado e adicionado
        const geoJsonLayer = L.geoJSON(feature as any, {
          style: {
            color,
            weight,
            opacity
          }
        });
        
        // Verifica se o layer foi criado corretamente
        if (geoJsonLayer) {
          geoJsonLayer.addTo(routeLayer);
          
          // Atualiza as estatísticas com verificações para evitar NaN
          if (props.distance && !isNaN(props.distance)) {
            totalDistance += props.distance;
          }
          
          if (props.duration && !isNaN(props.duration)) {
            totalDuration += props.duration;
          }
        }
      } catch (error) {
        console.error('Erro ao exibir rota:', error);
        // Continua com o próximo feature, não interrompe o loop
      }
    });
    
    return { 
      distance: isNaN(totalDistance) ? 0 : totalDistance, 
      duration: isNaN(totalDuration) ? 0 : totalDuration 
    };
  } catch (error) {
    console.error('Erro fatal ao exibir rota:', error);
    return { distance: 0, duration: 0 };
  }
};

// Mostrar notificação temporária na tela
export const mostrarNotificacao = (mensagem: string, tipo: 'sucesso' | 'erro' | 'info' = 'info', duracao = 3000) => {
  // Cores baseadas no tipo
  const cores = {
    sucesso: 'bg-green-600',
    erro: 'bg-red-600',
    info: 'bg-blue-600'
  };
  
  // Ícones baseados no tipo
  const icones = {
    sucesso: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>`,
    erro: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>`,
    info: `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
          </svg>`
  };
  
  const confirmacaoDiv = document.createElement('div');
  confirmacaoDiv.className = 'fixed inset-x-0 top-20 flex justify-center z-50';
  confirmacaoDiv.innerHTML = `
    <div class="${cores[tipo]} text-white px-4 py-2 rounded-full shadow-lg animate-bounce">
      <span class="flex items-center">
        ${icones[tipo]}
        ${mensagem}
      </span>
    </div>
  `;
  
  document.body.appendChild(confirmacaoDiv);
  
  // Remove após o tempo especificado
  setTimeout(() => {
    if (document.body.contains(confirmacaoDiv)) {
      document.body.removeChild(confirmacaoDiv);
    }
  }, duracao);
}; 