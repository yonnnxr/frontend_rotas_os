import { useEffect, useRef } from 'react';
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
  
  // Inicializa o mapa
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    try {
      // Aguarda um momento para garantir que o contêiner está totalmente renderizado
      setTimeout(() => {
        if (!mapRef.current || mapInstanceRef.current) return;
        
        // Região de Anastácio, MS
        const newMap = L.map(mapRef.current, {
          // Opções para reduzir erros
          fadeAnimation: false,
          zoomAnimation: false,
          markerZoomAnimation: false,
          inertia: false
        }).setView([-20.48, -55.80], 12);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(newMap);
        
        const newMarkersLayer = L.layerGroup().addTo(newMap);
        const newRouteLayer = L.layerGroup().addTo(newMap);
        
        mapInstanceRef.current = newMap;
        markersLayerRef.current = newMarkersLayer;
        routeLayerRef.current = newRouteLayer;
        
        // Dá mais tempo para o mapa renderizar completamente antes de notificar
        setTimeout(() => {
          if (newMap && newMap.getContainer() && newMap.getContainer().clientWidth > 0) {
            // Notifica o componente pai que o mapa está pronto
            onMapReady(newMap, newMarkersLayer, newRouteLayer);
          } else {
            console.error('Mapa não inicializou corretamente');
          }
        }, 300);
      }, 100);
    } catch (err) {
      console.error('Erro ao inicializar mapa:', err);
    }
    
    // Cleanup na desmontagem
    return () => {
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (err) {
          console.warn('Erro ao remover mapa:', err);
        }
      }
      mapInstanceRef.current = null;
      markersLayerRef.current = null;
      routeLayerRef.current = null;
    };
  }, [onMapReady]);
  
  // Atualiza o marcador de localização do usuário
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current || !userLocation) return;
    
    const markersLayer = markersLayerRef.current;
    
    // Remove marcadores antigos de localização do usuário
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
    
  }, [userLocation]);
  
  // Destaca a OS mais próxima quando ela muda
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    
    const markersLayer = markersLayerRef.current;
    
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
    
    // Se tivermos localização do usuário, mostra uma visualização que inclua ambos
    if (userLocation && mapInstanceRef.current) {
      try {
        // Verifica se o mapa está realmente pronto antes de tentar operações
        if (mapInstanceRef.current.getContainer() && 
            mapInstanceRef.current.getContainer().clientWidth > 0) {
          
          // Em vez de usar fitBounds, calculamos o centro entre o usuário e a OS
          const centerLat = (userLocation.lat + osProxima.lat) / 2;
          const centerLng = (userLocation.lng + osProxima.lng) / 2;
          
          // Calcula a distância aproximada para determinar o zoom
          const deltaLat = Math.abs(userLocation.lat - osProxima.lat);
          const deltaLng = Math.abs(userLocation.lng - osProxima.lng);
          const maxDelta = Math.max(deltaLat, deltaLng) * 1.5; // Adiciona margem
          
          // Determina um nível de zoom apropriado
          let zoomLevel = 15; // Zoom padrão
          if (maxDelta > 0.1) zoomLevel = 11;
          else if (maxDelta > 0.05) zoomLevel = 12;
          else if (maxDelta > 0.02) zoomLevel = 13;
          else if (maxDelta > 0.01) zoomLevel = 14;
          
          // Usa setTimeout para garantir que o mapa tenha tempo de renderizar
          setTimeout(() => {
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setView([centerLat, centerLng], zoomLevel, {
                animate: false // Desativa animação para evitar erros
              });
            }
          }, 200);
        }
      } catch (err) {
        console.warn('Erro ao ajustar mapa:', err);
      }
    }
    
  }, [osProxima, userLocation]);
  
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