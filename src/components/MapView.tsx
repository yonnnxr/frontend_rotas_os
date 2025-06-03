import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { OSPoint, UserLocation } from '../types';

interface MapViewProps {
  userLocation: UserLocation | null;
  osProxima: OSPoint | null;
  todasOrdens: OSPoint[];
  ordensAtendidas: string[];
  onOSClick: (os: OSPoint) => void;
  onMapReady: (map: L.Map, markersLayer: L.LayerGroup, routeLayer: L.LayerGroup) => void;
}

const MapView: React.FC<MapViewProps> = ({
  userLocation,
  osProxima,
  todasOrdens,
  ordensAtendidas: _ordensAtendidas, // Prefixo com underscore para indicar que não é usado
  onOSClick,
  onMapReady
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  
  // Flag para evitar operações em um mapa que está sendo desmontado
  const [isMapMounted, setIsMapMounted] = useState(false);
  const isMountedRef = useRef(true);
  
  // Inicializa o mapa apenas uma vez e mantém referência
  useEffect(() => {
    // Definimos este ref para controlar o ciclo de vida do componente
    isMountedRef.current = true;
    
    // Se o mapa já existe ou não temos elemento para anexá-lo, saímos
    if (!mapRef.current || mapInstanceRef.current) return;
    
    // Garantimos que o contêiner tem dimensões definidas
    if (mapRef.current) {
      mapRef.current.style.width = '100%';
      mapRef.current.style.height = '100%';
    }
    
    console.log('Iniciando criação do mapa...');
    
    try {
      // Criamos o mapa com opções mínimas e sem animações
      const newMap = L.map(mapRef.current, {
        fadeAnimation: false,
        zoomAnimation: false,
        markerZoomAnimation: false,
        inertia: false,
        preferCanvas: true,
      });
      
      // Definimos a view inicial sem animação
      newMap.setView([-20.48, -55.80], 12, { animate: false });
      
      // Adicionamos apenas o layer de base
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19
      }).addTo(newMap);
      
      // Criamos as camadas de marcadores e rotas
      const newMarkersLayer = L.layerGroup().addTo(newMap);
      const newRouteLayer = L.layerGroup().addTo(newMap);
      
      // Armazenamos referências
      mapInstanceRef.current = newMap;
      markersLayerRef.current = newMarkersLayer;
      routeLayerRef.current = newRouteLayer;
      
      // Usamos uma variável auxiliar para monitorar quando o mapa estiver pronto
      let mapReadyHandled = false;
      
      // Função para notificar que o mapa está pronto
      const notifyMapReady = () => {
        // Evitamos notificar múltiplas vezes
        if (mapReadyHandled || !isMountedRef.current) return;
        
        console.log('Mapa realmente pronto!');
        mapReadyHandled = true;
        setIsMapMounted(true);
        
        if (newMap && newMarkersLayer && newRouteLayer && isMountedRef.current) {
          // Notificamos o componente pai
          onMapReady(newMap, newMarkersLayer, newRouteLayer);
        }
      };
      
      // Usamos timeout para garantir que o DOM esteja completamente renderizado
      const readyTimer = setTimeout(() => {
        if (isMountedRef.current) {
          notifyMapReady();
        }
      }, 500);
      
      // Também usamos o evento whenReady como backup
      newMap.whenReady(() => {
        if (isMountedRef.current) {
          notifyMapReady();
        }
      });
      
      // Limpeza
      return () => {
        // Definimos que o componente não está mais montado
        isMountedRef.current = false;
        setIsMapMounted(false);
        
        // Limpamos o timer
        clearTimeout(readyTimer);
        
        console.log('Limpando recursos do mapa...');
        
        // Removemos o mapa se ele existir
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.remove();
            console.log('Mapa removido com sucesso');
          } catch (err) {
            console.warn('Erro ao remover mapa:', err);
          }
        }
        
        // Limpamos as referências
        mapInstanceRef.current = null;
        markersLayerRef.current = null;
        routeLayerRef.current = null;
        mapReadyHandled = false;
      };
    } catch (err) {
      console.error('Erro fatal ao inicializar mapa:', err);
    }
  }, []); // Dependências vazias para executar apenas uma vez
  
  // Atualiza o marcador de localização do usuário
  useEffect(() => {
    // Se o mapa não está montado ou não temos localização, saímos
    if (!isMapMounted || !mapInstanceRef.current || !markersLayerRef.current || !userLocation || !isMountedRef.current) return;
    
    const markersLayer = markersLayerRef.current;
    
    // Remove marcadores antigos de localização do usuário com segurança
    try {
      markersLayer.eachLayer(layer => {
        if ((layer as any)._icon?.classList.contains('user-location-icon')) {
          markersLayer.removeLayer(layer);
        }
      });
      
      // Adiciona um novo marcador para a localização do usuário
      const userIcon = L.divIcon({
        className: 'user-location-icon',
        html: `<div style="background-color:#4285F4;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.3);"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });
      
      const { lat, lng } = userLocation;
      
      // Adiciona o novo marcador
      const newMarker = L.marker([lat, lng], { icon: userIcon }).addTo(markersLayer);
      newMarker.bindPopup('Sua localização atual');
    } catch (err) {
      console.warn('Erro ao atualizar marcador de usuário:', err);
    }
  }, [userLocation, isMapMounted]);
  
  // Destaca a OS mais próxima quando ela muda
  useEffect(() => {
    // Se o mapa não está montado ou não temos a próxima OS, saímos
    if (!isMapMounted || !mapInstanceRef.current || !markersLayerRef.current || !isMountedRef.current) return;
    
    const markersLayer = markersLayerRef.current;
    
    try {
      // Remove qualquer destaque anterior de próxima OS
      markersLayer.eachLayer(layer => {
        if ((layer as any)._icon?.classList.contains('os-proxima-icon')) {
          markersLayer.removeLayer(layer);
        }
      });
      
      // Se não tiver uma próxima OS, apenas retorna
      if (!osProxima) return;
      
      // Adiciona um marcador destacado para a próxima OS
      const proximaIcon = L.divIcon({
        className: 'os-proxima-icon',
        html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;background-color:#FF3B30;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5);color:white;font-weight:bold;">
                 <span style="font-size:18px;">→</span>
               </div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });
      
      const marker = L.marker([osProxima.lat, osProxima.lng], { 
        icon: proximaIcon, 
        zIndexOffset: 1000 
      }).addTo(markersLayer);
      
      // Cria o conteúdo do popup
      const distanciaTexto = osProxima.distanceFromUser 
        ? `Distância: ${osProxima.distanceFromUser.toFixed(2)} km`
        : '';
      
      const popupContent = `
        <div style="text-align:center;">
          <h3 style="margin:0 0 8px;font-size:16px;color:#FF3B30;">Próxima OS</h3>
          <p style="margin:0 0 8px;font-weight:bold;">${osProxima.description}</p>
          ${distanciaTexto ? `<p style="margin:0 0 12px;">${distanciaTexto}</p>` : ''}
          <button
            onclick="window.dispatchEvent(new CustomEvent('navegar-para-os', {detail: {id: '${osProxima.id}'}}));"
            style="background-color:#007AFF;color:white;border:none;border-radius:4px;padding:10px;margin-bottom:10px;cursor:pointer;width:100%;font-size:16px;"
          >
            Navegar até aqui
          </button>
          <button
            onclick="window.dispatchEvent(new CustomEvent('os-concluida', {detail: {id: '${osProxima.id}'}}));"
            style="background-color:#34C759;color:white;border:none;border-radius:4px;padding:10px;cursor:pointer;width:100%;font-size:16px;"
          >
            Marcar como concluída
          </button>
        </div>
      `;
      
      marker.bindPopup(popupContent, {
        closeButton: false,
        autoClose: false,
        closeOnClick: false,
        className: 'os-popup-mobile',
        maxWidth: 280
      }).openPopup();
      
      // Se tivermos localização do usuário, vamos ajustar a visualização
      if (userLocation && mapInstanceRef.current && isMountedRef.current) {
        // Para segurança, não tentamos fazer nada de complicado aqui
        // Apenas definimos o zoom e a posição diretamente sem animação
        try {
          // Calculamos o centro
          const centerLat = (userLocation.lat + osProxima.lat) / 2;
          const centerLng = (userLocation.lng + osProxima.lng) / 2;
          
          // Definimos um zoom fixo que funciona bem na maioria dos casos
          const zoomLevel = 13;
          
          // Apenas mudamos o centro do mapa, sem animação
          mapInstanceRef.current.setView([centerLat, centerLng], zoomLevel, { 
            animate: false, 
            duration: 0
          });
        } catch (err) {
          console.warn('Erro ao ajustar mapa para OS próxima:', err);
        }
      }
    } catch (err) {
      console.warn('Erro ao destacar OS próxima:', err);
    }
  }, [osProxima, userLocation, isMapMounted]);
  
  // Adiciona CSS para melhorar a visualização em dispositivos móveis
  useEffect(() => {
    if (!document.getElementById('popup-mobile-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'popup-mobile-styles';
      styleEl.textContent = `
        .os-popup-mobile .leaflet-popup-content {
          margin: 12px;
          min-width: 200px;
        }
        .os-popup-mobile .leaflet-popup-content button {
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        @media (max-width: 640px) {
          .os-popup-mobile .leaflet-popup-content {
            min-width: 240px;
          }
          .os-popup-mobile .leaflet-popup-content button {
            padding: 12px;
            font-size: 16px;
            margin-bottom: 12px;
          }
        }
      `;
      document.head.appendChild(styleEl);
    }
    
    return () => {
      const styleEl = document.getElementById('popup-mobile-styles');
      if (styleEl) {
        document.head.removeChild(styleEl);
      }
    };
  }, []);
  
  // Configura os event listeners para os botões do popup
  useEffect(() => {
    const handleNavigarParaOS = (e: CustomEvent<{ id: string }>) => {
      const os = todasOrdens.find(o => o.id === e.detail.id);
      if (os) {
        onOSClick(os);
      }
    };
    
    window.addEventListener('navegar-para-os', handleNavigarParaOS as EventListener);
    
    return () => {
      window.removeEventListener('navegar-para-os', handleNavigarParaOS as EventListener);
    };
  }, [todasOrdens, onOSClick]);
  
  return (
    <div ref={mapRef} className="h-full w-full"></div>
  );
};

export default MapView; 