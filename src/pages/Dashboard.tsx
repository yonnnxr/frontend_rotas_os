import { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Tipos
interface DashboardProps {
  onLogout: () => void
}

interface GeoJSONFeature {
  type: string
  geometry: {
    type: string
    coordinates: number[] | number[][] | number[][][]
  }
  properties: Record<string, any>
}

interface GeoJSONData {
  type: string
  features: GeoJSONFeature[]
  metadata?: Record<string, any>
}

interface UserLocation {
  lat: number
  lng: number
  accuracy: number
}

interface OSPoint {
  lat: number
  lng: number
  order: number
  id: string
  description: string
  feature: GeoJSONFeature
  distanceFromUser?: number
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [map, setMap] = useState<L.Map | null>(null)
  const [markersLayer, setMarkersLayer] = useState<L.LayerGroup | null>(null)
  const [routeLayer, setRouteLayer] = useState<L.LayerGroup | null>(null)
  const [optimizedRoute, setOptimizedRoute] = useState<GeoJSONData | null>(null)
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({
    ordersCount: 0,
    routeDistance: 0,
    routeDuration: 0,
  })
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null)
  const [osProxima, setOsProxima] = useState<OSPoint | null>(null)
  const [todasOrdens, setTodasOrdens] = useState<OSPoint[]>([])
  const [ordensAtendidas, setOrdensAtendidas] = useState<string[]>([])
  const [modoNavegacao, setModoNavegacao] = useState(false)
  const [mostrarPopupLocalizacao, setMostrarPopupLocalizacao] = useState(false)
  
  // Inicializa o mapa
  useEffect(() => {
    if (!mapRef.current || map) return

    // Região de Anastácio, MS
    const newMap = L.map(mapRef.current).setView([-20.48, -55.80], 12)
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(newMap)
    
    const newMarkersLayer = L.layerGroup().addTo(newMap)
    const newRouteLayer = L.layerGroup().addTo(newMap)
    
    setMap(newMap)
    setMarkersLayer(newMarkersLayer)
    setRouteLayer(newRouteLayer)
    
    // Solicita permissão de localização após inicializar o mapa
    setMostrarPopupLocalizacao(true)
    
    // Cleanup na desmontagem
    return () => {
      newMap.remove()
    }
  }, [])
  
  // Carrega as ordens de serviço quando o componente é montado
  useEffect(() => {
    if (!map || !markersLayer) return
    loadOrders()
  }, [map, markersLayer])
  
  // Função para obter a localização atual do usuário
  const obterLocalizacaoUsuario = () => {
    setMostrarPopupLocalizacao(false)
    setLoading(true)
    
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          
          // Atualiza o estado com a localização do usuário
          setUserLocation({
            lat: latitude,
            lng: longitude,
            accuracy
          });
          
          // Centraliza o mapa na posição do usuário e adiciona um marcador
          if (map) {
            map.setView([latitude, longitude], 15);
            
            // Adiciona um marcador para a localização do usuário
            const userIcon = L.divIcon({
              className: 'user-location-icon',
              html: `<div style="background-color:#4285F4;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 0 5px rgba(0,0,0,0.3);"></div>`,
              iconSize: [24, 24],
              iconAnchor: [12, 12]
            });
            
            // Remove marcadores antigos e adiciona o novo
            if (markersLayer) {
              // Remove apenas marcadores de usuário anteriores
              markersLayer.eachLayer(layer => {
                if ((layer as any)._icon?.classList.contains('user-location-icon')) {
                  markersLayer.removeLayer(layer);
                }
              });
              
              // Adiciona o novo marcador
              const newMarker = L.marker([latitude, longitude], { icon: userIcon }).addTo(markersLayer);
              newMarker.bindPopup('Sua localização atual');
            }
          }
          
          setLoading(false);
          
          // Inicia o modo de navegação por proximidade automaticamente
          iniciarNavegacaoProximidade();
        },
        (error) => {
          console.error('Erro ao obter localização:', error.message);
          alert(`Não foi possível obter sua localização: ${error.message}. A navegação por proximidade requer acesso à sua localização.`);
          setLoading(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      alert('Geolocalização não é suportada pelo seu navegador. A navegação por proximidade não funcionará.');
      setLoading(false);
    }
  };

  // Função para abrir navegação no Google Maps para uma ordem de serviço
  const openGoogleMapsNavigation = (lat: number, lng: number) => {
    if (!userLocation) {
      alert('Obtenha sua localização atual primeiro');
      obterLocalizacaoUsuario();
      return;
    }
    
    // Cria uma URL para o Google Maps com direções da posição atual até a ordem de serviço
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${lat},${lng}&travelmode=driving`;
    
    // Abre em uma nova aba
    window.open(googleMapsUrl, '_blank');
  };

  // Função para carregar as ordens de serviço
  const loadOrders = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')
      const teamId = localStorage.getItem('team_id')
      
      if (!token || !teamId) {
        onLogout()
        return
      }
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000'
      const url = `${apiUrl}/api/teams/${teamId}/geojson`
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      })
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          console.error('Erro de autenticação, fazendo logout')
          onLogout()
          return
        }
        
        // Tenta rota alternativa
        const fallbackResponse = await fetch(`${apiUrl}/orders`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        })
        
        if (fallbackResponse.ok) {
          const geojsonData = await fallbackResponse.json()
          displayOrders(geojsonData)
          return
        }
        
        throw new Error('Erro ao carregar ordens de serviço')
      }
      
      const geojsonData = await response.json()
      displayOrders(geojsonData)
    } catch (error) {
      console.error('Erro ao carregar ordens:', error)
      alert(error instanceof Error ? error.message : 'Erro ao carregar ordens')
    } finally {
      setLoading(false)
    }
  }
  
  // Função para exibir as ordens no mapa
  const displayOrders = (geojsonData: GeoJSONData) => {
    if (!map || !markersLayer) return
    
    // Limpa apenas os marcadores de ordens, preservando o marcador do usuário
    markersLayer.eachLayer(layer => {
      if (!(layer as any)._icon?.classList.contains('user-location-icon')) {
        markersLayer.removeLayer(layer);
      }
    });
    
    // Verifica se temos dados para exibir
    if (!geojsonData?.features?.length) {
      setStats(prev => ({ ...prev, ordersCount: 0 }))
      return
    }
    
    // Filtra apenas as ordens de serviço (pontos)
    const orderFeatures = geojsonData.features.filter((feature: GeoJSONFeature) => 
      feature.geometry && feature.geometry.type === 'Point'
    )
    
    // Atualiza estatísticas
    setStats(prev => ({ ...prev, ordersCount: orderFeatures.length }))
    
    // Cria um grupo de coordenadas para calcular o centro
    const points: [number, number][] = []
    
    // Adiciona os pontos ao mapa
    orderFeatures.forEach((feature: GeoJSONFeature) => {
      try {
        if (!feature.geometry?.coordinates || feature.geometry.coordinates.length < 2) return
        
        // No GeoJSON, o formato é [longitude, latitude]
        const coords = feature.geometry.coordinates as [number, number]
        
        // Correção para Anastácio (deslocamento de 12 graus para oeste)
        const origLng = coords[0]
        const origLat = coords[1]
        const lng = origLng - 12
        const lat = origLat
        
        // Adiciona à lista de pontos
        points.push([lat, lng])
        
        // Propriedades do ponto
        const props = feature.properties || {}
        const orderNumber = props.route_order || ''
        
        // Determina a cor com base na situação
        let color = '#DC2626' // Vermelho (pendente)
        const situacao = (props.situacao || props.status || '').toLowerCase()
        
        if (situacao.includes('exec')) {
          color = '#10B981' // Verde
        } else if (situacao.includes('prog')) {
          color = '#F59E0B' // Laranja
        }
        
        // Cria o marcador circular
        const marker = L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: color,
          color: '#fff',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        }).addTo(markersLayer)
        
        // Adiciona o número da ordem, se disponível
        if (orderNumber) {
          L.marker([lat, lng], {
            icon: L.divIcon({
              className: 'order-number-icon',
              html: `<div style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;background-color:white;border:2px solid #1a73e8;border-radius:50%;color:#1a73e8;font-weight:bold;font-size:12px;">${orderNumber}</div>`,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })
          }).addTo(markersLayer)
        }
        
        // Configura o popup com botão para navegação
        const ordemServico = props.ordem_servico || props.nroos || 'N/A'
        const status = props.status || props.situacao || 'Pendente'
        const equipe = props.equipe || props.equipeexec || localStorage.getItem('team_name')
        
        let popupContent = `
          <div>
            <strong>OS:</strong> ${ordemServico}<br>
            <strong>Status:</strong> ${status}<br>
            <strong>Equipe:</strong> ${equipe}<br>
        `
        
        if (props.route_order) {
          popupContent += `<strong>Ordem na Rota:</strong> ${props.route_order}<br>`
        }
        
        if (props.descgrupo) {
          popupContent += `<strong>Grupo:</strong> ${props.descgrupo}<br>`
        }
        
        if (props.logradouro) {
          popupContent += `<strong>Endereço:</strong> ${props.logradouro}, ${props.num || 'S/N'}`
          if (props.bairro) popupContent += `, ${props.bairro}`
          popupContent += `<br>`
        }
        
        if (props.localidade || props.municipio) {
          popupContent += `<strong>Localidade:</strong> ${props.localidade || props.municipio}<br>`
        }
        
        // Adiciona botão para navegação via Google Maps
        popupContent += `
          <button 
            onclick="window.dispatchEvent(new CustomEvent('navigate-to-order', {detail: {lat: ${lat}, lng: ${lng}}}));"
            style="background-color:#1a73e8;color:white;border:none;border-radius:4px;padding:5px 10px;margin-top:8px;cursor:pointer;width:100%;"
          >
            Navegar até aqui
          </button>
        </div>`
        
        marker.bindPopup(popupContent)
      } catch (error) {
        console.error('Erro ao adicionar ponto:', error)
      }
    })
    
    // Exibe a rota, se houver (apenas visualmente)
    displayRoute(geojsonData)
    
    // Ajusta o zoom para mostrar todos os pontos
    if (points.length > 0) {
      map.fitBounds(L.latLngBounds(points))
    }
    
    // Adiciona listener para eventos de navegação
    window.addEventListener('navigate-to-order', ((e: CustomEvent) => {
      const { lat, lng } = e.detail;
      openGoogleMapsNavigation(lat, lng);
    }) as EventListener);
  }
  
  // Função para exibir a rota visualmente (apenas visualização, sem navegação interna)
  const displayRoute = (geojsonData: GeoJSONData) => {
    if (!map || !routeLayer) return
    
    routeLayer.clearLayers()
    
    // Verifica se há uma rota para exibir
    const routeFeatures = geojsonData.features.filter(feature => 
      feature.geometry.type === 'LineString' || 
      feature.properties?.type === 'route' || 
      feature.properties?.type === 'traffic_route'
    )
    
    if (routeFeatures.length === 0) {
      setStats(prev => ({ ...prev, routeDistance: 0, routeDuration: 0 }))
      return
    }
    
    // Adiciona cada rota ao mapa
    routeFeatures.forEach(feature => {
      try {
        const props = feature.properties || {}
        const color = props.color || '#0066CC'
        const weight = props.weight || 4
        const opacity = props.opacity || 0.7
        
        // Cria a linha da rota
        L.geoJSON(feature as any, {
          style: {
            color,
            weight,
            opacity
          }
        }).addTo(routeLayer)
        
        // Atualiza as estatísticas
        if (props.distance || props.duration) {
          setStats(prev => ({
            ...prev,
            routeDistance: props.distance || 0,
            routeDuration: props.duration || 0
          }))
        }
      } catch (error) {
        console.error('Erro ao exibir rota:', error)
      }
    })
    
    // Armazena a rota otimizada
    setOptimizedRoute(geojsonData)
  }

  // Função para calcular a distância entre dois pontos (em km)
  const calcularDistancia = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
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
  const encontrarOSMaisProxima = () => {
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

  // Função para iniciar navegação por proximidade
  const iniciarNavegacaoProximidade = async () => {
    try {
      setLoading(true);
      
      // Primeiro, obtém a localização atual se não tiver
      if (!userLocation) {
        await new Promise<void>((resolve, reject) => {
          if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
              (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                setUserLocation({
                  lat: latitude,
                  lng: longitude,
                  accuracy
                });
                resolve();
              },
              (error) => {
                alert(`Não foi possível obter sua localização: ${error.message}`);
                setLoading(false);
                reject(new Error('Localização necessária para iniciar navegação'));
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              }
            );
          } else {
            alert('Geolocalização não é suportada pelo seu navegador');
            setLoading(false);
            reject(new Error('Geolocalização não suportada'));
          }
        });
      }
      
      // Obtém rota otimizada do backend (apenas para visualização)
      const token = localStorage.getItem('token');
      const teamId = localStorage.getItem('team_id');
      
      if (!token || !teamId) {
        onLogout();
        return;
      }
      
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
      const url = `${apiUrl}/api/teams/${teamId}/geojson`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Erro ao obter ordens de serviço: ${response.status}`);
      }
      
      const data: GeoJSONData = await response.json();
      
      // Filtra apenas os pontos (ordens)
      const orderFeatures = data.features.filter(feature => 
        feature.geometry && feature.geometry.type === 'Point'
      );
      
      if (orderFeatures.length === 0) {
        alert('Não há ordens de serviço para navegar');
        setLoading(false);
        return;
      }
      
      // Armazena todas as ordens de serviço
      const todasOS = orderFeatures.map(feature => {
        const coords = feature.geometry.coordinates as number[];
        return {
          lat: coords[1],
          lng: coords[0] - 12, // Correção para Anastácio
          order: feature.properties?.route_order || 0,
          id: feature.properties?.id || feature.properties?.ordem_servico || '',
          description: feature.properties?.ordem_servico || feature.properties?.nroos || 'OS',
          feature: feature
        };
      });
      
      setTodasOrdens(todasOS);
      
      // Encontra a OS mais próxima
      setModoNavegacao(true);
      atualizarProximaOS();
      
      // Atualiza a visualização no mapa
      displayOrders(data);
      
    } catch (error) {
      console.error('Erro ao iniciar navegação:', error);
      alert(error instanceof Error ? error.message : 'Erro ao iniciar navegação');
      setModoNavegacao(false);
    } finally {
      setLoading(false);
    }
  };

  // Função para atualizar qual é a próxima OS
  const atualizarProximaOS = () => {
    const proxima = encontrarOSMaisProxima();
    setOsProxima(proxima);
    
    if (proxima) {
      // Destaca visualmente a próxima OS no mapa
      destacarProximaOS(proxima);
      
      // Centraliza o mapa incluindo o usuário e a próxima OS
      if (map && userLocation) {
        const bounds = L.latLngBounds(
          [userLocation.lat, userLocation.lng],
          [proxima.lat, proxima.lng]
        );
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    } else if (ordensAtendidas.length > 0) {
      // Todas as ordens foram atendidas
      alert('Parabéns! Você concluiu todas as ordens de serviço.');
      setModoNavegacao(false);
    }
  };

  // Função para destacar visualmente a próxima OS no mapa
  const destacarProximaOS = (os: OSPoint) => {
    if (!map || !markersLayer) return;
    
    // Remove qualquer destaque anterior
    markersLayer.eachLayer(layer => {
      if ((layer as any)._icon?.classList.contains('os-proxima-icon')) {
        markersLayer.removeLayer(layer);
      }
    });
    
    // Adiciona um marcador destacado para a próxima OS
    const proximaIcon = L.divIcon({
      className: 'os-proxima-icon',
      html: `<div style="display:flex;align-items:center;justify-content:center;width:36px;height:36px;background-color:#FF3B30;border-radius:50%;border:3px solid white;box-shadow:0 0 10px rgba(0,0,0,0.5);color:white;font-weight:bold;">
               <span style="font-size:18px;">→</span>
             </div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18]
    });
    
    const marker = L.marker([os.lat, os.lng], { icon: proximaIcon, zIndexOffset: 1000 }).addTo(markersLayer);
    
    // Abre automaticamente o popup
    const popupContent = `
      <div style="text-align:center;">
        <h3 style="margin:0 0 8px;font-size:16px;color:#FF3B30;">Próxima OS</h3>
        <p style="margin:0 0 8px;font-weight:bold;">${os.description}</p>
        <p style="margin:0 0 12px;">Distância: ${os.distanceFromUser?.toFixed(2) || '?'} km</p>
        <button
          onclick="window.dispatchEvent(new CustomEvent('navegar-para-proxima-os'));"
          style="background-color:#007AFF;color:white;border:none;border-radius:4px;padding:10px;margin-bottom:10px;cursor:pointer;width:100%;font-size:16px;"
        >
          Navegar até aqui
        </button>
        <button
          onclick="window.dispatchEvent(new CustomEvent('os-concluida', {detail: {id: '${os.id}'}}));"
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
      className: 'os-popup-mobile', // Classe CSS para estilização específica
      maxWidth: 280
    }).openPopup();
    
    // Adiciona CSS para melhorar a visualização em dispositivos móveis
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
  };

  // Função para marcar uma OS como concluída
  const marcarOSComoConcluida = (id: string) => {
    if (!id) return;
    
    // Verificar se a OS já não foi atendida
    if (ordensAtendidas.includes(id)) {
      alert('Esta ordem de serviço já foi concluída!');
      return;
    }
    
    // Verificar se ainda há OS não atendidas
    const ordensRestantes = todasOrdens.filter(os => !ordensAtendidas.includes(os.id));
    if (ordensRestantes.length <= 1) { // A última é a que estamos concluindo agora
      // Adiciona a OS atual à lista de concluídas
      setOrdensAtendidas(prev => [...prev, id]);
      
      // Mostra mensagem de conclusão
      setTimeout(() => {
        alert('Parabéns! Você concluiu todas as ordens de serviço.');
        setModoNavegacao(false);
        setOsProxima(null);
      }, 500);
      return;
    }
    
    // Adiciona a OS atual à lista de concluídas
    setOrdensAtendidas(prev => [...prev, id]);
    
    // Mostra confirmação visual temporária
    if (map) {
      const confirmacaoDiv = document.createElement('div');
      confirmacaoDiv.className = 'fixed inset-x-0 top-20 flex justify-center z-50';
      confirmacaoDiv.innerHTML = `
        <div class="bg-green-600 text-white px-4 py-2 rounded-full shadow-lg animate-bounce">
          <span class="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
            </svg>
            OS concluída com sucesso!
          </span>
        </div>
      `;
      
      document.body.appendChild(confirmacaoDiv);
      
      // Remove após alguns segundos
      setTimeout(() => {
        document.body.removeChild(confirmacaoDiv);
      }, 2000);
    }
  };

  // Função para navegar para a próxima OS
  const navegarParaProximaOS = () => {
    if (!osProxima || !userLocation) return;
    
    // Cria uma URL para o Google Maps com direções da posição atual até a ordem de serviço
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${osProxima.lat},${osProxima.lng}&travelmode=driving`;
    
    // Abre em uma nova aba
    window.open(googleMapsUrl, '_blank');
  };

  // Adiciona event listeners para os eventos personalizados
  useEffect(() => {
    const handleOSConcluida = (e: CustomEvent) => {
      marcarOSComoConcluida(e.detail.id);
    };
    
    const handleNavegarParaOS = () => {
      navegarParaProximaOS();
    };
    
    window.addEventListener('os-concluida', handleOSConcluida as EventListener);
    window.addEventListener('navegar-para-proxima-os', handleNavegarParaOS as EventListener);
    
    return () => {
      window.removeEventListener('os-concluida', handleOSConcluida as EventListener);
      window.removeEventListener('navegar-para-proxima-os', handleNavegarParaOS as EventListener);
    };
  }, [osProxima, userLocation]);

  // Efeito para localização continua durante navegação
  useEffect(() => {
    if (!modoNavegacao) return;
    
    // Configurar monitoramento contínuo de localização
    let watchId: number | null = null;
    
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          setUserLocation({
            lat: latitude,
            lng: longitude,
            accuracy
          });
          
          // Atualizar próxima OS baseada na nova localização
          atualizarProximaOS();
        },
        (error) => {
          console.error('Erro ao monitorar localização:', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }
    
    // Limpar na desmontagem
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [modoNavegacao, todasOrdens, ordensAtendidas]);

  // Efeito para atualizar a próxima OS quando a lista de OS atendidas muda
  useEffect(() => {
    if (modoNavegacao && userLocation) {
      atualizarProximaOS();
    }
  }, [modoNavegacao, ordensAtendidas, userLocation]);

  return (
    <div className="h-screen flex flex-col">
      <div className="bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-semibold text-gray-900">Sistema de Ordens de Serviço</h1>
            <div className="flex items-center">
              <span className="mr-4 text-sm text-gray-600">
                {stats.ordersCount} ordens de serviço
                {modoNavegacao && ordensAtendidas.length > 0 && (
                  <span className="ml-2 text-green-600">({ordensAtendidas.length} concluídas)</span>
                )}
              </span>
              <button
                onClick={onLogout}
                className="ml-4 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-gray-100 border-b">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between">
          <div className="flex space-x-2">
            {!modoNavegacao ? (
              <button
                onClick={obterLocalizacaoUsuario}
                disabled={loading}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Iniciar Navegação
              </button>
            ) : (
              <>
                {osProxima ? (
                  <button
                    onClick={navegarParaProximaOS}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    Navegar para {osProxima.description}
                  </button>
                ) : null}
                
                <button
                  onClick={() => {
                    setModoNavegacao(false);
                    setOrdensAtendidas([]);
                    setOsProxima(null);
                    loadOrders();
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Encerrar Navegação
                </button>
              </>
            )}
          </div>
          
          {optimizedRoute && stats.routeDistance > 0 && (
            <div className="text-sm text-gray-700 font-medium">
              Rota: {stats.routeDistance.toFixed(1)} km ({stats.routeDuration.toFixed(0)} min)
            </div>
          )}
        </div>
      </div>
      
      <div className="flex-1 flex overflow-hidden">
        <div className="w-full h-full relative">
          <div ref={mapRef} className="h-full w-full"></div>
          
          {loading && (
            <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10">
              <div className="p-4 rounded-md bg-white shadow-md text-center">
                <svg className="animate-spin h-8 w-8 mx-auto text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="mt-2 text-gray-700">Carregando...</p>
              </div>
            </div>
          )}
          
          {mostrarPopupLocalizacao && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
              <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
                <h3 className="text-lg font-medium mb-3">Permissão de Localização</h3>
                <p className="mb-4 text-gray-600">
                  Para funcionar corretamente, o sistema precisa acessar sua localização atual.
                  Isso permitirá encontrar a ordem de serviço mais próxima de você.
                </p>
                <div className="flex justify-end space-x-3">
                  <button 
                    onClick={() => setMostrarPopupLocalizacao(false)}
                    className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={obterLocalizacaoUsuario}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Permitir Acesso
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 