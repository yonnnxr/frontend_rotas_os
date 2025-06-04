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
  // Novo estado para rastrear se o usuário já respondeu ao popup de localização
  const [usuarioRespondeuPopup, setUsuarioRespondeuPopup] = useState(false)
  
  // Inicializa o componente - Este useEffect só é executado uma vez na montagem
  useEffect(() => {
    // Carregar as ordens no início
    carregarDados()
    
    // Forçar a exibição do popup de permissão logo após o login, apenas se o usuário não respondeu antes
    if (!usuarioRespondeuPopup) {
      console.log("Mostrando popup de localização inicial")
      setMostrarPopupLocalizacao(true)
    }
  }, []) // Execute apenas uma vez na montagem
  
  // Este useEffect monitora se o usuário tem localização e decide se mostra o popup
  useEffect(() => {
    // Se o usuário já respondeu ou já tem localização, não mostramos o popup
    if (usuarioRespondeuPopup || userLocation) {
      return
    }
    
    console.log("Verificando necessidade de popup de localização")
    
    // Só mostramos o popup se:
    // 1. O usuário não respondeu antes
    // 2. Não tem localização
    // 3. Não está em modo navegação
    if (!modoNavegacao) {
      setMostrarPopupLocalizacao(true)
    }
    
    // Não usamos setInterval para evitar problemas de temporização
  }, [userLocation, modoNavegacao, usuarioRespondeuPopup])
  
  // Função para garantir que o popup de localização permaneça visível
  const forcarMostrarPopupLocalizacao = () => {
    // Mais simples e direto: se não temos localização, mostramos o popup
    if (!userLocation) {
      console.log('Forçando exibição do popup de localização')
      setMostrarPopupLocalizacao(true)
      // Garantimos que o estado de resposta do usuário seja resetado se ainda não temos localização
      setUsuarioRespondeuPopup(false)
    }
  }
  
  // Adicionar um efeito para verificar periodicamente se o popup deve ser exibido
  useEffect(() => {
    // Verificamos a cada 3 segundos se o popup deve ser exibido
    const verificarPopupTimer = setInterval(() => {
      // Se não temos localização, força exibição do popup
      if (!userLocation) {
        forcarMostrarPopupLocalizacao()
      }
    }, 3000)
    
    return () => {
      clearInterval(verificarPopupTimer)
    }
  }, [userLocation])
  
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
    if (!map || !markersLayer) {
      console.error('Mapa ou camada de marcadores não inicializados');
      return;
    }
    
    // Limpa apenas os marcadores de ordens, preservando o marcador do usuário
    markersLayer.eachLayer(layer => {
      if (!(layer as any)._icon?.classList.contains('user-location-icon')) {
        markersLayer.removeLayer(layer);
      }
    });
    
    // Verifica se temos dados para exibir
    if (!geojsonData?.features?.length) {
      console.warn('Não há dados GeoJSON para exibir');
      return;
    }
    
    console.log(`Exibindo ${geojsonData.features.length} features no mapa`);
    
    // Filtra apenas as ordens de serviço (pontos)
    const orderFeatures = geojsonData.features.filter((feature: GeoJSONFeature) => 
      feature.geometry && feature.geometry.type === 'Point'
    );
    
    console.log(`Encontradas ${orderFeatures.length} ordens de serviço (pontos)`);
    
    if (orderFeatures.length === 0) {
      console.warn('Não há pontos de ordens de serviço para exibir');
      return;
    }
    
    // Adiciona os pontos ao mapa
    const points: [number, number][] = [];
    let marcadoresAdicionados = 0;
    
    orderFeatures.forEach((feature: GeoJSONFeature, index: number) => {
      try {
        if (!feature.geometry?.coordinates || feature.geometry.coordinates.length < 2) {
          console.warn(`Feature #${index} sem coordenadas válidas`);
          return;
        }
        
        // No GeoJSON, o formato é [longitude, latitude]
        const coords = feature.geometry.coordinates as [number, number];
        
        // Correção para Anastácio (deslocamento de 12 graus para oeste)
        const origLng = coords[0];
        const origLat = coords[1];
        const lng = origLng - 12;
        const lat = origLat;
        
        // Validações extras para evitar problemas
        if (isNaN(lat) || isNaN(lng) || !isFinite(lat) || !isFinite(lng)) {
          console.warn(`Feature #${index} com coordenadas inválidas: lat=${lat}, lng=${lng}`);
          return;
        }
        
        // Validação de faixa de coordenadas
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          console.warn(`Feature #${index} com coordenadas fora da faixa: lat=${lat}, lng=${lng}`);
          return;
        }
        
        // Adiciona à lista de pontos
        points.push([lat, lng]);
        
        // Propriedades do ponto
        const props = feature.properties || {};
        const orderNumber = props.route_order || '';
        
        // Determina a cor com base na situação
        let color = '#DC2626'; // Vermelho (pendente)
        const situacao = (props.situacao || props.status || '').toLowerCase();
        
        if (situacao.includes('exec')) {
          color = '#10B981'; // Verde
        } else if (situacao.includes('prog')) {
          color = '#F59E0B'; // Laranja
        }
        
        // Verifica se a ordem já foi atendida localmente
        const osId = props.id || props.ordem_servico || '';
        if (ordensAtendidas.includes(osId)) {
          color = '#10B981'; // Verde (concluída)
        }
        
        // Cria o marcador circular
        try {
          const marker = L.circleMarker([lat, lng], {
            radius: 8,
            fillColor: color,
            color: '#fff',
            weight: 1,
            opacity: 1,
            fillOpacity: 0.8
          }).addTo(markersLayer);
          
          // Adiciona o número da ordem, se disponível
          if (orderNumber) {
            L.marker([lat, lng], {
              icon: L.divIcon({
                className: 'order-number-icon',
                html: `<div style="display:flex;align-items:center;justify-content:center;width:20px;height:20px;background-color:white;border:2px solid #1a73e8;border-radius:50%;color:#1a73e8;font-weight:bold;font-size:12px;">${orderNumber}</div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })
            }).addTo(markersLayer);
          }
          
          // Configura o popup com botão para navegação
          const ordemServico = props.ordem_servico || props.nroos || 'N/A';
          const status = props.status || props.situacao || 'Pendente';
          const equipe = props.equipe || props.equipeexec || localStorage.getItem('team_name');
          
          let popupContent = `
            <div>
              <strong>OS:</strong> ${ordemServico}<br>
              <strong>Status:</strong> ${ordensAtendidas.includes(osId) ? 'Concluída' : status}<br>
              <strong>Equipe:</strong> ${equipe}<br>
          `;
          
          if (props.route_order) {
            popupContent += `<strong>Ordem na Rota:</strong> ${props.route_order}<br>`;
          }
          
          if (props.descgrupo) {
            popupContent += `<strong>Grupo:</strong> ${props.descgrupo}<br>`;
          }
          
          if (props.logradouro) {
            popupContent += `<strong>Endereço:</strong> ${props.logradouro}, ${props.num || 'S/N'}`;
            if (props.bairro) popupContent += `, ${props.bairro}`;
            popupContent += `<br>`;
          }
          
          if (props.localidade || props.municipio) {
            popupContent += `<strong>Localidade:</strong> ${props.localidade || props.municipio}<br>`;
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
            `;
          } else {
            popupContent += `
              <div style="margin-top:8px;padding:5px 10px;background-color:#D1FAE5;color:#065F46;border-radius:4px;text-align:center;">
                ✓ Ordem concluída
              </div>
            `;
          }
          
          popupContent += `</div>`;
          
          marker.bindPopup(popupContent);
          marcadoresAdicionados++;
        } catch (error) {
          console.error(`Erro ao adicionar marcador para ponto #${index}:`, error);
        }
      } catch (error) {
        console.error(`Erro ao processar ponto #${index}:`, error);
      }
    });
    
    console.log(`Adicionados ${marcadoresAdicionados} marcadores ao mapa de ${orderFeatures.length} features`);
    
    // Ajusta o zoom para mostrar todos os pontos apenas se tivermos pontos válidos
    if (points.length > 0 && map) {
      try {
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50] });
        console.log('Zoom ajustado para mostrar todos os pontos');
      } catch (error) {
        console.error('Erro ao ajustar zoom:', error);
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
    
    console.log('Mapa inicializado, armazenando referências');
    
    // Armazena as referências
    setMap(mapInstance);
    setMarkersLayer(markersLayerInstance);
    setRouteLayer(routeLayerInstance);
    
    // Força o recarregamento das ordens para garantir que elas sejam exibidas
    carregarDados().then(() => {
      console.log('Dados recarregados após inicialização do mapa');
      
      // Se já temos dados carregados, exibe-os agora que o mapa está pronto
      if (optimizedRoute) {
        // Primeiro garante que o mapa está completamente inicializado
        setTimeout(() => {
          try {
            // Verifica se o mapa ainda existe e está pronto para uso
            if (mapInstance && 
                mapInstance.getContainer() && 
                markersLayerInstance && 
                routeLayerInstance) {
              
              console.log('Exibindo ordens e rotas no mapa após inicialização');
              
              // Exibe as ordens no mapa com segurança
              exibirOrdens(optimizedRoute);
              
              // Exibe a rota no mapa
              if (routeLayerInstance) {
                try {
                  const { distance, duration } = exibirRota(optimizedRoute, routeLayerInstance);
                  
                  setStats(prev => ({
                    ...prev,
                    routeDistance: distance,
                    routeDuration: duration
                  }));
                } catch (err) {
                  console.error('Erro ao exibir rota:', err);
                }
              }
              
              // Depois de exibir tudo, ajusta o zoom para mostrar todos os pontos
              setTimeout(() => {
                try {
                  if (mapInstance && todasOrdens.length > 0) {
                    const bounds = L.latLngBounds(todasOrdens.map(os => [os.lat, os.lng]));
                    mapInstance.fitBounds(bounds, { padding: [50, 50] });
                  }
                } catch (err) {
                  console.warn('Erro ao ajustar zoom do mapa:', err);
                  
                  // Tenta uma abordagem alternativa - definir um zoom fixo
                  try {
                    if (todasOrdens.length > 0) {
                      const centerLat = todasOrdens.reduce((sum, os) => sum + os.lat, 0) / todasOrdens.length;
                      const centerLng = todasOrdens.reduce((sum, os) => sum + os.lng, 0) / todasOrdens.length;
                      mapInstance.setView([centerLat, centerLng], 13, { animate: false });
                    }
                  } catch (e) {
                    console.error('Erro ao centralizar mapa:', e);
                  }
                }
              }, 300);
            }
          } catch (e) {
            console.warn('Erro ao exibir dados após inicialização do mapa:', e);
          }
        }, 500);
      }
    }).catch(err => {
      console.error('Erro ao recarregar dados após inicialização do mapa:', err);
    });
  }
  
  // Função para obter a localização atual do usuário
  const handleObterLocalizacao = () => {
    // Marcar que o usuário respondeu ao popup
    setUsuarioRespondeuPopup(true)
    setMostrarPopupLocalizacao(false)
    setLoading(true)
    
    obterLocalizacaoUsuario(
      // Callback de sucesso
      (location) => {
        setUserLocation(location)
        
        // Centraliza o mapa na posição do usuário, com verificação de segurança
        if (map) {
          try {
            const leafletMap = map as any
            if (leafletMap && leafletMap._loaded) {
              // Abordagem mais segura: primeiro definir zoom, depois posição
              map.setZoom(15, { animate: false })
              map.panTo([location.lat, location.lng], { animate: false })
            }
          } catch (e) {
            console.warn('Erro ao centralizar mapa na posição do usuário:', e)
          }
        }
        
        setLoading(false)
        
        // Removido o início automático da navegação por proximidade
        // Agora o usuário precisa clicar no botão "Iniciar Navegação" explicitamente
        mostrarNotificacao('Localização obtida com sucesso. Clique em "Iniciar Navegação" para começar.', 'sucesso')
      },
      // Callback de erro
      (errorMessage) => {
        mostrarNotificacao(
          `Não foi possível obter sua localização: ${errorMessage}. Você ainda pode usar o sistema, mas algumas funcionalidades serão limitadas.`,
          'info'
        )
        setLoading(false)
      }
    )
  }
  
  // Função para continuar sem localização
  const handleContinuarSemLocalizacao = () => {
    // Marcar que o usuário respondeu ao popup
    setUsuarioRespondeuPopup(true)
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
      
      // Verificar se temos a localização do usuário
      if (!userLocation) {
        console.log('Usuário tentou iniciar navegação sem localização')
        // Reseta estados para garantir que o popup seja exibido
        setUsuarioRespondeuPopup(false)
        setMostrarPopupLocalizacao(true)
        
        // Notifica o usuário sobre a necessidade de permissão
        mostrarNotificacao(
          'Para iniciar a navegação, é necessário permitir o acesso à sua localização.',
          'info'
        )
        
        setLoading(false)
        return
      }
      
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
    
    // Verificar se a OS existe na lista de ordens carregadas
    const osExiste = todasOrdens.find(os => os.id === id)
    if (!osExiste) {
      mostrarNotificacao('Ordem de serviço não encontrada no sistema!', 'erro')
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
    <div className="h-screen flex flex-col relative">
      {/* Popup de permissão de localização - Posicionado no topo da hierarquia para máxima prioridade */}
      {mostrarPopupLocalizacao && !userLocation && (
        <div className="fixed inset-0 z-[9999] bg-black bg-opacity-60 backdrop-blur-sm flex items-center justify-center">
          <PermissaoLocalizacao
            onPermitir={handleObterLocalizacao}
            onNegar={handleContinuarSemLocalizacao}
          />
        </div>
      )}
      
      {/* Cabeçalho */}
      <div className="bg-white shadow-md relative z-10">
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
      <div className="bg-gray-100 border-b relative z-10">
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
          <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-50">
            <div className="p-4 rounded-md bg-white shadow-md text-center">
              <svg className="animate-spin h-8 w-8 mx-auto text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="mt-2 text-gray-700">Carregando...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 