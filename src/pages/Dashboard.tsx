import { useState, useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Componentes
import MapView from '../components/MapView'
import OSList from '../components/OSList'
import PermissaoLocalizacao from '../components/PermissaoLocalizacao'

// Tipos
import { GeoJSONData, UserLocation, OSPoint, GeoJSONFeature } from '../types'

// Serviços e utilitários
import { carregarOrdens, processarOrdens, atualizarStatusOS, ApiError } from '../services/apiService'
import { encontrarOSMaisProxima, obterLocalizacaoUsuario } from '../utils/geoUtils'
import { navegarParaGoogleMaps, exibirRota, mostrarNotificacao } from '../utils/mapUtils'

interface DashboardProps {
  onLogout: () => void
}

export default function Dashboard({ onLogout }: DashboardProps) {
  // Estado do mapa
  const [map, setMap] = useState<L.Map | null>(null)
  const [markersLayer, setMarkersLayer] = useState<L.LayerGroup | null>(null)
  const [routeLayer, setRouteLayer] = useState<L.LayerGroup | null>(null)
  const [optimizedRoute, setOptimizedRoute] = useState<GeoJSONData | null>(null)
  
  // Estado da aplicação
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
  const [mostrarListaOS, setMostrarListaOS] = useState(false)
  
  // Inicializa o componente
  useEffect(() => {
    // Carregar as ordens no início
    carregarDados()
    
    // Mostrar popup de localização após um breve atraso
    const timer = setTimeout(() => {
      setMostrarPopupLocalizacao(true)
    }, 1000)
    
    return () => clearTimeout(timer)
  }, [])
  
  // Função para carregar os dados das ordens
  const carregarDados = async () => {
    try {
      setLoading(true)
      
      const dadosGeoJSON = await carregarOrdens()
      const ordens = processarOrdens(dadosGeoJSON)
      
      setTodasOrdens(ordens)
      setStats(prev => ({ ...prev, ordersCount: ordens.length }))
      
      // Só exibe no mapa se ele já estiver inicializado
      if (map && markersLayer && routeLayer) {
        // Exibe visualmente no mapa
        exibirOrdens(dadosGeoJSON)
        const { distance, duration } = exibirRota(dadosGeoJSON, routeLayer)
        
        setStats(prev => ({
          ...prev,
          routeDistance: distance,
          routeDuration: duration
        }))
      } else {
        console.log('Mapa ainda não inicializado, dados carregados mas não exibidos')
        // Vamos guardar os dados para exibir quando o mapa estiver pronto
        setOptimizedRoute(dadosGeoJSON)
      }
      
      setOptimizedRoute(dadosGeoJSON)
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        alert('Sua sessão expirou. Faça login novamente.')
        onLogout()
      } else {
        alert(error instanceof Error ? error.message : 'Erro ao carregar ordens')
      }
    } finally {
      setLoading(false)
    }
  }
  
  // Função para exibir as ordens no mapa
  const exibirOrdens = (geojsonData: GeoJSONData) => {
    if (!map || !markersLayer) return
    
    // Limpa apenas os marcadores de ordens, preservando o marcador do usuário
    markersLayer.eachLayer(layer => {
      if (!(layer as any)._icon?.classList.contains('user-location-icon')) {
        markersLayer.removeLayer(layer)
      }
    })
    
    // Verifica se temos dados para exibir
    if (!geojsonData?.features?.length) {
      return
    }
    
    // Filtra apenas as ordens de serviço (pontos)
    const orderFeatures = geojsonData.features.filter((feature: GeoJSONFeature) => 
      feature.geometry && feature.geometry.type === 'Point'
    )
    
    // Adiciona os pontos ao mapa
    const points: [number, number][] = []
    
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
        
        // Verifica se a ordem já foi atendida localmente
        const osId = props.id || props.ordem_servico || ''
        if (ordensAtendidas.includes(osId)) {
          color = '#10B981' // Verde (concluída)
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
            <strong>Status:</strong> ${ordensAtendidas.includes(osId) ? 'Concluída' : status}<br>
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
        
        // Adiciona botões para navegação e marcar como concluída (se não estiver concluída)
        if (!ordensAtendidas.includes(osId)) {
          popupContent += `
            <div style="display:flex;gap:5px;margin-top:8px;">
              <button 
                onclick="window.dispatchEvent(new CustomEvent('navigate-to-order', {detail: {lat: ${lat}, lng: ${lng}, id: '${osId}'}}));"
                style="background-color:#1a73e8;color:white;border:none;border-radius:4px;padding:5px 10px;cursor:pointer;flex:1;"
              >
                Navegar
              </button>
              <button 
                onclick="window.dispatchEvent(new CustomEvent('os-concluida', {detail: {id: '${osId}'}}));"
                style="background-color:#10B981;color:white;border:none;border-radius:4px;padding:5px 10px;cursor:pointer;flex:1;"
              >
                Concluir
              </button>
            </div>
          `
        } else {
          popupContent += `
            <div style="margin-top:8px;padding:5px 10px;background-color:#D1FAE5;color:#065F46;border-radius:4px;text-align:center;">
              ✓ Ordem concluída
            </div>
          `
        }
        
        popupContent += `</div>`
        
        marker.bindPopup(popupContent)
      } catch (error) {
        console.error('Erro ao adicionar ponto:', error)
      }
    })
    
    // Ajusta o zoom para mostrar todos os pontos - com proteção contra erros
    if (points.length > 0) {
      try {
        // Em vez de usar fitBounds, vamos calcular o centro manualmente
        // e usar setView com um zoom fixo, que é menos propenso a erros
        
        // Calcula o centro de todos os pontos
        let totalLat = 0;
        let totalLng = 0;
        points.forEach(point => {
          totalLat += point[0]; // Latitude
          totalLng += point[1]; // Longitude
        });
        
        const centerLat = totalLat / points.length;
        const centerLng = totalLng / points.length;
        
        // Usa um timeout para garantir que o DOM foi atualizado
        setTimeout(() => {
          try {
            if (map && map.getContainer()) {
              // Define um nível de zoom fixo que geralmente funciona bem para grupos de pontos
              const zoomLevel = 13; 
              
              // Use setView sem animação
              map.setView([centerLat, centerLng], zoomLevel, {
                animate: false
              });
            }
          } catch (e) {
            console.warn('Erro ao ajustar visualização do mapa:', e);
          }
        }, 200);
      } catch (e) {
        console.warn('Erro ao preparar ajuste de visualização:', e);
      }
    }
  }
  
  // Função chamada quando o mapa é inicializado
  const handleMapReady = (
    mapInstance: L.Map, 
    markersLayerInstance: L.LayerGroup, 
    routeLayerInstance: L.LayerGroup
  ) => {
    // Verifica se o mapa está em um estado válido
    if (!mapInstance || !mapInstance.getContainer()) {
      console.error('Mapa não inicializado corretamente');
      return;
    }
    
    // Armazena as referências
    setMap(mapInstance);
    setMarkersLayer(markersLayerInstance);
    setRouteLayer(routeLayerInstance);
    
    // Se já temos dados carregados, exibe-os agora que o mapa está pronto
    if (optimizedRoute && todasOrdens.length > 0) {
      // Usa um timeout maior para garantir que o DOM esteja completamente renderizado
      setTimeout(() => {
        try {
          // Verifica novamente se o mapa ainda é válido
          if (mapInstance && mapInstance.getContainer() && 
              mapInstance.getContainer().clientWidth > 0) {
            
            // Exibe as ordens no mapa
            exibirOrdens(optimizedRoute);
            
            // Exibe a rota, com verificação de segurança
            const { distance, duration } = exibirRota(optimizedRoute, routeLayerInstance);
            
            // Atualiza as estatísticas
            setStats(prev => ({
              ...prev,
              routeDistance: distance,
              routeDuration: duration
            }));
          }
        } catch (e) {
          console.warn('Erro ao exibir dados após inicialização do mapa:', e);
        }
      }, 500); // Aumentamos o timeout para 500ms
    }
  }
  
  // Função para obter a localização atual do usuário
  const handleObterLocalizacao = () => {
    setMostrarPopupLocalizacao(false);
    setLoading(true);
    
    obterLocalizacaoUsuario(
      // Callback de sucesso
      (location) => {
        setUserLocation(location);
        
        // Centraliza o mapa na posição do usuário, com verificação de segurança
        if (map) {
          try {
            setTimeout(() => {
              if (map && map.getContainer()) {
                map.setView([location.lat, location.lng], 15, {
                  animate: false // Desativa animação para evitar erros
                });
              }
            }, 100);
          } catch (e) {
            console.warn('Erro ao centralizar mapa:', e);
          }
        }
        
        setLoading(false);
        
        // Inicia o modo de navegação por proximidade automaticamente
        iniciarNavegacaoProximidade();
      },
      // Callback de erro
      (errorMessage) => {
        mostrarNotificacao(
          `Não foi possível obter sua localização: ${errorMessage}. Você ainda pode usar o sistema, mas algumas funcionalidades serão limitadas.`,
          'info'
        );
        setLoading(false);
      }
    );
  }
  
  // Função para continuar sem localização
  const handleContinuarSemLocalizacao = () => {
    setMostrarPopupLocalizacao(false)
    mostrarNotificacao(
      'Continuando sem compartilhar localização. Você pode solicitar acesso depois clicando em "Iniciar Navegação".',
      'info'
    )
  }
  
  // Função para iniciar navegação por proximidade
  const iniciarNavegacaoProximidade = async () => {
    try {
      setLoading(true)
      
      // Se não tiver ordens carregadas ainda, carrega
      if (todasOrdens.length === 0) {
        await carregarDados()
      }
      
      // Configura o modo de navegação
      setModoNavegacao(true)
      atualizarProximaOS()
      
    } catch (error) {
      console.error('Erro ao iniciar navegação:', error)
      alert(error instanceof Error ? error.message : 'Erro ao iniciar navegação')
      setModoNavegacao(false)
    } finally {
      setLoading(false)
    }
  }
  
  // Função para atualizar qual é a próxima OS
  const atualizarProximaOS = () => {
    console.log("Atualizando próxima OS, ordens atendidas:", ordensAtendidas)
    const proxima = encontrarOSMaisProxima(userLocation, todasOrdens, ordensAtendidas)
    
    if (proxima) {
      console.log("Nova OS próxima encontrada:", proxima.id, proxima.description)
      setOsProxima(proxima)
      
      // Se tivermos localização, calcula a distância para exibição
      if (userLocation) {
        // A função encontrarOSMaisProxima já calcula as distâncias
      }
    } else if (ordensAtendidas.length > 0) {
      // Todas as ordens foram atendidas
      mostrarNotificacao('Parabéns! Você concluiu todas as ordens de serviço.', 'sucesso')
      setModoNavegacao(false)
      setOsProxima(null)
    }
  }
  
  // Função para marcar uma OS como concluída
  const marcarOSComoConcluida = (id: string) => {
    if (!id) return
    
    // Verificar se a OS já não foi atendida
    if (ordensAtendidas.includes(id)) {
      mostrarNotificacao('Esta ordem de serviço já foi concluída!', 'info')
      return
    }
    
    // Verificar se ainda há OS não atendidas
    const ordensRestantes = todasOrdens.filter(os => !ordensAtendidas.includes(os.id))
    if (ordensRestantes.length <= 1) { // A última é a que estamos concluindo agora
      // Adiciona a OS atual à lista de concluídas
      setOrdensAtendidas(prev => [...prev, id])
      
      // Atualiza a visualização no mapa
      if (optimizedRoute) {
        exibirOrdens(optimizedRoute)
      }
      
      // Mostra mensagem de conclusão
      setTimeout(() => {
        mostrarNotificacao('Parabéns! Você concluiu todas as ordens de serviço.', 'sucesso')
        setModoNavegacao(false)
        setOsProxima(null)
      }, 300)
      return
    }
    
    // Adiciona a OS atual à lista de concluídas
    setOrdensAtendidas(prev => [...prev, id])
    
    // Atualiza a visualização no mapa
    if (optimizedRoute) {
      exibirOrdens(optimizedRoute)
    }
    
    // Envia atualização para a API (não bloqueia o fluxo)
    atualizarStatusOS(id, 'Concluída').catch(err => {
      console.warn('Erro ao atualizar status na API (continuando localmente):', err)
    })
    
    // Mostra confirmação visual
    mostrarNotificacao('OS concluída com sucesso!', 'sucesso')
    
    // Força uma atualização imediata da próxima OS
    setTimeout(() => {
      atualizarProximaOS()
    }, 300)
  }
  
  // Função para navegar para uma OS específica
  const navegarParaOS = (os: OSPoint) => {
    navegarParaGoogleMaps(userLocation, { lat: os.lat, lng: os.lng })
  }
  
  // Efeito para monitorar a localização durante o modo de navegação
  useEffect(() => {
    if (!modoNavegacao) return
    
    // Configurar monitoramento contínuo de localização
    let watchId: number | null = null
    
    if ('geolocation' in navigator) {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords
          setUserLocation({
            lat: latitude,
            lng: longitude,
            accuracy
          })
        },
        (error) => {
          console.error('Erro ao monitorar localização:', error.message)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      )
    }
    
    // Limpar na desmontagem
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [modoNavegacao])
  
  // Adiciona event listeners para os eventos personalizados
  useEffect(() => {
    const handleOSConcluida = (e: CustomEvent<{ id: string }>) => {
      marcarOSComoConcluida(e.detail.id)
    }
    
    const handleNavegarParaOS = (e: CustomEvent<{ lat: number, lng: number, id: string }>) => {
      const os = todasOrdens.find(o => o.id === e.detail.id) || {
        lat: e.detail.lat,
        lng: e.detail.lng
      }
      navegarParaGoogleMaps(userLocation, os)
    }
    
    window.addEventListener('os-concluida', handleOSConcluida as EventListener)
    window.addEventListener('navigate-to-order', handleNavegarParaOS as EventListener)
    
    return () => {
      window.removeEventListener('os-concluida', handleOSConcluida as EventListener)
      window.removeEventListener('navigate-to-order', handleNavegarParaOS as EventListener)
    }
  }, [todasOrdens, userLocation])
  
  return (
    <div className="h-screen flex flex-col">
      {/* Cabeçalho */}
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
      
      {/* Barra de ferramentas */}
      <div className="bg-gray-100 border-b">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between">
          <div className="flex flex-wrap items-center space-x-2">
            {!modoNavegacao ? (
              <>
                <button
                  onClick={handleObterLocalizacao}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Iniciar Navegação
                </button>
              </>
            ) : (
              <>
                {osProxima ? (
                  <button
                    onClick={() => navegarParaOS(osProxima)}
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
                    setModoNavegacao(false)
                    setOrdensAtendidas([])
                    setOsProxima(null)
                    carregarDados()
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
            
            <button
              onClick={() => setMostrarListaOS(!mostrarListaOS)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              {mostrarListaOS ? 'Ocultar Lista' : 'Ver Lista'}
            </button>
          </div>
          
          {optimizedRoute && stats.routeDistance > 0 && (
            <div className="text-sm text-gray-700 font-medium">
              Rota: {stats.routeDistance.toFixed(1)} km ({stats.routeDuration.toFixed(0)} min)
            </div>
          )}
        </div>
      </div>
      
      {/* Conteúdo principal */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className={`h-full ${mostrarListaOS ? 'w-3/4' : 'w-full'} transition-all duration-300`}>
          <MapView
            userLocation={userLocation}
            osProxima={osProxima}
            todasOrdens={todasOrdens}
            ordensAtendidas={ordensAtendidas}
            onOSClick={navegarParaOS}
            onMapReady={handleMapReady}
          />
        </div>
        
        {mostrarListaOS && (
          <div className="h-full w-1/4 overflow-auto border-l border-gray-200 bg-white shadow-md">
            <OSList
              ordens={todasOrdens}
              ordensAtendidas={ordensAtendidas}
              osProximaId={osProxima?.id || null}
              userLat={userLocation?.lat}
              userLng={userLocation?.lng}
              onSelectOS={navegarParaOS}
              onConcluirOS={marcarOSComoConcluida}
            />
          </div>
        )}
        
        {/* Loading overlay */}
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
        
        {/* Modal de permissão de localização */}
        {mostrarPopupLocalizacao && (
          <PermissaoLocalizacao
            onPermitir={handleObterLocalizacao}
            onNegar={handleContinuarSemLocalizacao}
          />
        )}
      </div>
    </div>
  )
} 