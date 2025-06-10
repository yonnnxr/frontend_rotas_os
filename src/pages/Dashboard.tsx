import { useState, useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ReactDOM from 'react-dom'
import Spinner from '../components/Spinner'

// Componentes
import MapView from '../components/MapView'
import OSList from '../components/OSList'
import PermissaoLocalizacao from '../components/PermissaoLocalizacao'

// Tipos
import { GeoJSONData, UserLocation, OSPoint, GeoJSONFeature } from '../types'

// Serviços e utilitários
import { carregarOrdens, processarOrdens, atualizarStatusOS, ApiError } from '../services/apiService'
import { encontrarOSMaisProxima, obterLocalizacaoUsuario, calcularDistancia } from '../utils/geoUtils'
import { 
  navegarParaGoogleMaps, 
  exibirRota, 
  mostrarNotificacao, 
  exibirRotaNoMapa 
} from '../utils/mapUtils'

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
  const [statusOrdens, setStatusOrdens] = useState<Record<string, string>>({})
  const [modoNavegacao, setModoNavegacao] = useState(false)
  const [mostrarPopupLocalizacao, setMostrarPopupLocalizacao] = useState(false)
  const [mostrarListaOS, setMostrarListaOS] = useState(false)
  // Estado para rastrear se o usuário já respondeu ao popup de localização
  const [usuarioRespondeuPopup, setUsuarioRespondeuPopup] = useState(false)
  
  // Inicializa o componente - Este useEffect só é executado uma vez na montagem
  useEffect(() => {
    // Carregar as ordens no início
    carregarDados()
    
    // Forçar a exibição do popup de permissão logo após o login
    console.log("Inicializando Dashboard - verificando necessidade de popup")
    if (!usuarioRespondeuPopup && !userLocation) {
      console.log("Mostrando popup de permissão inicial")
      setTimeout(() => {
        setMostrarPopupLocalizacao(true)
      }, 1000)
    }
  }, []) // Execute apenas uma vez na montagem
  
  // Este useEffect monitora se o usuário tem localização e decide se mostra o popup
  useEffect(() => {
    console.log("Estado da localização alterado:", userLocation ? "Localização obtida" : "Sem localização", 
                "Resposta do usuário:", usuarioRespondeuPopup ? "Respondeu" : "Não respondeu")
    
    // Se o usuário já respondeu ou já tem localização, não mostramos o popup
    if (usuarioRespondeuPopup || userLocation) {
      return
    }
    
    // Só mostramos o popup se:
    // 1. O usuário não respondeu antes
    // 2. Não tem localização
    // 3. Não está em modo navegação
    if (!modoNavegacao) {
      console.log("Mostrando popup de permissão após verificação")
      setTimeout(() => {
        setMostrarPopupLocalizacao(true)
      }, 500)
    }
    
  }, [userLocation, modoNavegacao, usuarioRespondeuPopup])
  
  // Função para garantir que o popup de localização permaneça visível
  const forcarMostrarPopupLocalizacao = () => {
    // Se não temos localização e o usuário não respondeu, mostramos o popup
    if (!userLocation && !usuarioRespondeuPopup) {
      console.log('Forçando exibição do popup de localização')
      setMostrarPopupLocalizacao(true)
    }
  }
  
  // Adicionar um efeito para verificar periodicamente se o popup deve ser exibido
  useEffect(() => {
    // Verificamos a cada 5 segundos se o popup deve ser exibido
    const verificarPopupTimer = setInterval(() => {
      // Se não temos localização e o usuário não respondeu, força exibição do popup
      if (!userLocation && !usuarioRespondeuPopup) {
        forcarMostrarPopupLocalizacao()
      }
    }, 5000)
    
    return () => {
      clearInterval(verificarPopupTimer)
    }
  }, [userLocation, usuarioRespondeuPopup])
  
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
              
              console.log('Exibindo ordens e rotas no mapa após inicialização', optimizedRoute);
              console.log('Número de features no GeoJSON:', optimizedRoute.features.length);
              
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
                    console.log('Ajustando zoom para mostrar todas as ordens:', todasOrdens.length);
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
      } else {
        console.warn('Não há dados de rota otimizada para exibir após inicialização do mapa');
      }
    }).catch(err => {
      console.error('Erro ao recarregar dados após inicialização do mapa:', err);
    });
  }
  
  // Função para exibir as ordens no mapa
  const exibirOrdens = (geojsonData: GeoJSONData) => {
    if (!map || !markersLayer) {
      console.error('Mapa ou camada de marcadores não inicializados');
      return;
    }
    
    console.log('Iniciando exibição de ordens no mapa, camada de marcadores:', markersLayer);
    
    // Limpa apenas os marcadores de ordens, preservando o marcador do usuário
    try {
      let contadorRemovidos = 0;
      markersLayer.eachLayer(layer => {
        if (!(layer as any)._icon?.classList.contains('user-location-icon')) {
          markersLayer.removeLayer(layer);
          contadorRemovidos++;
        }
      });
      console.log(`Removidos ${contadorRemovidos} marcadores antigos`);
    } catch (e) {
      console.error('Erro ao limpar marcadores antigos:', e);
    }
    
    // Verifica se temos dados para exibir
    if (!geojsonData?.features?.length) {
      console.warn('Não há dados GeoJSON para exibir');
      return;
    }
    
    console.log(`Exibindo ${geojsonData.features.length} features no mapa`);
    console.log('Estrutura dos dados GeoJSON:', JSON.stringify(geojsonData.features[0], null, 2).substring(0, 500) + '...');
    
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
    
    // Tenta uma abordagem diferente para adicionar os marcadores
    try {
      // Primeiro convertemos o GeoJSON para um formato mais simples
      const ordens = processarOrdens(geojsonData);
      console.log(`Processadas ${ordens.length} ordens a partir do GeoJSON:`, ordens.map(o => ({id: o.id, lat: o.lat, lng: o.lng})));
      
      // Armazena as ordens processadas no estado - IMPORTANTE: isto deve acontecer ANTES de adicionar os marcadores
      setTodasOrdens(ordens);
      
      // Agora adicionamos os marcadores diretamente usando as coordenadas processadas
      ordens.forEach((os, index) => {
        try {
          // Validações extras
          if (isNaN(os.lat) || isNaN(os.lng) || !isFinite(os.lat) || !isFinite(os.lng)) {
            console.warn(`Ordem #${index} (${os.id}) com coordenadas inválidas: lat=${os.lat}, lng=${os.lng}`);
            return;
          }
          
          // Validação de faixa de coordenadas
          if (os.lat < -90 || os.lat > 90 || os.lng < -180 || os.lng > 180) {
            console.warn(`Ordem #${index} (${os.id}) com coordenadas fora da faixa: lat=${os.lat}, lng=${os.lng}`);
            return;
          }
          
          // Adiciona à lista de pontos para ajustar o zoom depois
          points.push([os.lat, os.lng]);
          
          // Determina a cor com base na situação
          let color = '#DC2626'; // Vermelho (pendente)
          const situacao = (os.status || '').toLowerCase();
          
          if (situacao.includes('exec')) {
            color = '#10B981'; // Verde
          } else if (situacao.includes('prog')) {
            color = '#F59E0B'; // Laranja
          }
          
          // Verifica se a ordem já foi atendida localmente
          if (ordensAtendidas.includes(os.id)) {
            color = '#10B981'; // Verde (concluída)
          }
          
          // Cria o marcador circular
          try {
            const marker = L.circleMarker([os.lat, os.lng], {
              radius: 8,
              fillColor: color,
              color: '#fff',
              weight: 1,
              opacity: 1,
              fillOpacity: 0.8
            }).addTo(markersLayer);
            
            // Configura o popup com botão para navegação
            const popupContent = `
              <div>
                <strong>OS:</strong> ${os.description}<br>
                <strong>Status:</strong> ${ordensAtendidas.includes(os.id) ? 'Concluída' : os.status || 'Pendente'}<br>
                <strong>Equipe:</strong> ${localStorage.getItem('team_name') || ''}<br>
                <strong>ID:</strong> ${os.id}<br>
                
                <div style="display:flex;gap:5px;margin-top:8px;">
                  ${!ordensAtendidas.includes(os.id) ? `
                    <button 
                      onclick="window.dispatchEvent(new CustomEvent('navigate-to-order', {detail: {lat: ${os.lat}, lng: ${os.lng}, id: '${os.id}'}}));"
                      style="background-color:#1a73e8;color:white;border:none;border-radius:4px;padding:5px 10px;cursor:pointer;flex:1;"
                    >
                      Navegar
                    </button>
                    <button 
                      onclick="window.dispatchEvent(new CustomEvent('os-concluida', {detail: {id: '${os.id}'}}));"
                      style="background-color:#10B981;color:white;border:none;border-radius:4px;padding:5px 10px;cursor:pointer;flex:1;"
                    >
                      Concluir
                    </button>
                  ` : `
                    <div style="margin-top:8px;padding:5px 10px;background-color:#D1FAE5;color:#065F46;border-radius:4px;text-align:center;width:100%;">
                      ✓ Ordem concluída
                    </div>
                  `}
                </div>
              </div>
            `;
            
            marker.bindPopup(popupContent);
            marcadoresAdicionados++;
          } catch (error) {
            console.error(`Erro ao adicionar marcador para ordem #${index} (${os.id}):`, error);
          }
        } catch (error) {
          console.error(`Erro ao processar ordem #${index}:`, error);
        }
      });
      
      console.log(`Adicionados ${marcadoresAdicionados} marcadores ao mapa a partir de ${ordens.length} ordens`);
    } catch (e) {
      console.error('Erro crítico ao adicionar marcadores:', e);
      
      // Mantém o código original como fallback
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
            
            // Configura o popup com botão para navegação
            const ordemServico = props.ordem_servico || props.nroos || 'N/A';
            const status = props.status || props.situacao || 'Pendente';
            const equipe = props.equipe || props.equipeexec || localStorage.getItem('team_name');
            
            let popupContent = `
              <div>
                <strong>OS:</strong> ${ordemServico}<br>
                <strong>Status:</strong> ${ordensAtendidas.includes(osId) ? 'Concluída' : status}<br>
                <strong>Equipe:</strong> ${equipe}<br>
                <strong>ID:</strong> ${osId}<br>
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
    }
    
    console.log(`Total: Adicionados ${marcadoresAdicionados} marcadores ao mapa de ${orderFeatures.length} features`);
    
    // Ajusta o zoom para mostrar todos os pontos apenas se tivermos pontos válidos
    if (points.length > 0 && map) {
      try {
        console.log(`Ajustando zoom para mostrar ${points.length} pontos`);
        const bounds = L.latLngBounds(points);
        map.fitBounds(bounds, { padding: [50, 50] });
        console.log('Zoom ajustado para mostrar todos os pontos');
      } catch (error) {
        console.error('Erro ao ajustar zoom:', error);
      }
    }
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
  
  // Função para marcar uma OS como concluída
  const marcarOSComoConcluida = (id: string) => {
    if (!id) {
      console.error('ID da OS não informado');
      return;
    }
    
    console.log(`Tentando marcar OS ${id} como concluída`);
    console.log(`Estado atual - total de ordens: ${todasOrdens.length}, ordens atendidas: ${ordensAtendidas.length}`);
    console.log(`IDs das ordens carregadas: ${todasOrdens.map(os => os.id).join(', ')}`);
    
    // Verificar se a OS já não foi atendida
    if (ordensAtendidas.includes(id)) {
      console.log(`OS ${id} já foi concluída anteriormente`);
      mostrarNotificacao('Esta ordem de serviço já foi concluída!', 'info');
      return;
    }
    
    // Verificar se a OS existe na lista de ordens carregadas
    const osExiste = todasOrdens.find(os => os.id === id);
    if (!osExiste) {
      console.error(`OS ${id} não encontrada na lista de ordens carregadas`);
      console.log('Lista de IDs disponíveis:', todasOrdens.map(os => os.id));
      mostrarNotificacao('Ordem de serviço não encontrada no sistema!', 'erro');
      return;
    }
    
    console.log(`OS ${id} encontrada, prosseguindo com a conclusão`);
    
    // Verificar se ainda há OS não atendidas
    const ordensRestantes = todasOrdens.filter(os => !ordensAtendidas.includes(os.id));
    console.log(`Restam ${ordensRestantes.length} ordens após esta conclusão`);
    
    // Atualizamos o estado da OS
    const novaListaAtendidas = [...ordensAtendidas, id];
    console.log("Nova lista de ordens atendidas:", novaListaAtendidas);
    
    // Atualiza o status interno da ordem
    const novosStatus = {
      ...statusOrdens,
      [id]: 'CONCLUIDA_APP'
    };
    console.log("Novos status internos:", novosStatus);
    
    // Primeiro atualizamos os estados
    setStatusOrdens(novosStatus);
    setOrdensAtendidas(novaListaAtendidas);
    
    // Atualiza o status da OS localmente também
    setTodasOrdens(prev => 
      prev.map(os => 
        os.id === id ? { ...os, status: 'Concluída' } : os
      )
    );
    
    // Atualiza a visualização no mapa
    if (optimizedRoute) {
      console.log('Atualizando exibição do mapa após marcar OS como concluída');
      exibirOrdens(optimizedRoute);
    }
    
    // Envia atualização para a API (não bloqueia o fluxo)
    atualizarStatusOS(id, 'Concluída').catch(err => {
      console.warn('Erro ao atualizar status na API (continuando localmente):', err);
    });
    
    // Mostra confirmação visual
    mostrarNotificacao('OS concluída com sucesso!', 'sucesso');
    
    // Força uma atualização imediata da próxima OS
    setTimeout(() => {
      console.log('Atualizando próxima OS após conclusão');
      // Log para diagnóstico antes da atualização
      console.log("Antes de atualizarProximaOS - ordensAtendidas:", ordensAtendidas);
      console.log("Antes de atualizarProximaOS - statusOrdens:", statusOrdens);
      
      atualizarProximaOS();
      
      // Busca a próxima OS mais próxima após a atualização
      setTimeout(() => {
        if (userLocation) {
          // Log para diagnóstico antes de encontrar próxima OS
          console.log("Antes de encontrarOSMaisProxima - ordensAtendidas:", ordensAtendidas);
          console.log("Antes de encontrarOSMaisProxima - statusOrdens:", statusOrdens);
          
          const proximaOS = encontrarOSMaisProxima(userLocation, todasOrdens, novaListaAtendidas, novosStatus);
          
          if (proximaOS) {
            console.log('Navegando automaticamente para a próxima OS:', proximaOS.id);
            setOsProxima(proximaOS);
            
            // Exibe a rota visual no mapa
            if (map && routeLayer) {
              exibirRotaNoMapa(map, routeLayer, userLocation, proximaOS)
                .then(sucesso => {
                  if (sucesso) {
                    mostrarNotificacao(`Próxima OS: ${proximaOS.description}`, 'info');
                    
                    // Dispara um evento personalizado para focar no marcador da próxima OS
                    window.dispatchEvent(new CustomEvent('focar-proxima-os', {
                      detail: { id: proximaOS.id }
                    }));
                  }
                });
            }
          } else {
            console.log("Nenhuma próxima OS disponível após a conclusão.");
            mostrarNotificacao('Todas as ordens de serviço foram concluídas!', 'sucesso');
          }
        }
      }, 300);
    }, 300);
  }
  
  // Função para navegar para uma OS específica
  const navegarParaOS = (os: OSPoint) => {
    // Verifica se é para mostrar a rota no mapa primeiro
    if (modoNavegacao && userLocation && map && routeLayer) {
      // Exibe a rota visualmente no mapa
      exibirRotaNoMapa(map, routeLayer, userLocation, os)
        .then(sucesso => {
          if (sucesso) {
            mostrarNotificacao(`Rota para ${os.description} exibida no mapa`, 'info');
            setOsProxima(os);
          } else {
            // Se falhar ao exibir no mapa, abre diretamente no Google Maps
            navegarParaGoogleMaps(userLocation, { lat: os.lat, lng: os.lng });
          }
        })
        .catch(() => {
          // Em caso de erro, usa o fallback para o Google Maps
          navegarParaGoogleMaps(userLocation, { lat: os.lat, lng: os.lng });
        });
    } else {
      // Se não estiver em modo navegação ou não tiver mapa, abre diretamente no Google Maps
      navegarParaGoogleMaps(userLocation, { lat: os.lat, lng: os.lng });
    }
  }
  
  // Quando o usuário clica no botão "Iniciar Navegação" na interface
  const handleIniciarNavegacao = () => {
    // Se não temos localização, precisamos obter primeiro
    if (!userLocation) {
      console.log('Iniciando navegação - solicitando localização primeiro')
      setUsuarioRespondeuPopup(false)
      setMostrarPopupLocalizacao(true)
      return
    }
    
    try {
      setLoading(true)
      
      // Se não tiver ordens carregadas ainda, carrega
      if (todasOrdens.length === 0) {
        carregarDados().then(() => {
          // Configura o modo de navegação e atualiza a próxima OS
          setModoNavegacao(true)
          atualizarProximaOS()
          
          // NOVA FUNCIONALIDADE: Exibe a rota para a próxima OS
          setTimeout(() => {
            if (map && routeLayer && osProxima) {
              exibirRotaNoMapa(map, routeLayer, userLocation, osProxima)
                .then(sucesso => {
                  if (sucesso) {
                    mostrarNotificacao(`Rota para ${osProxima.description} exibida no mapa`, 'info');
                  }
                });
            }
          }, 500);
          
          setLoading(false)
        }).catch(error => {
          console.error('Erro ao carregar dados:', error)
          setModoNavegacao(false)
          setLoading(false)
          mostrarNotificacao('Erro ao iniciar navegação. Tente novamente.', 'erro')
        })
      } else {
        // Se já temos ordens carregadas, apenas inicia a navegação
        setModoNavegacao(true)
        atualizarProximaOS()
        
        // NOVA FUNCIONALIDADE: Exibe a rota para a próxima OS
        setTimeout(() => {
          if (map && routeLayer && osProxima) {
            exibirRotaNoMapa(map, routeLayer, userLocation, osProxima)
              .then(sucesso => {
                if (sucesso) {
                  mostrarNotificacao(`Rota para ${osProxima.description} exibida no mapa`, 'info');
                }
              });
          }
        }, 500);
        
        setLoading(false)
      }
    } catch (error) {
      console.error('Erro ao iniciar navegação:', error)
      mostrarNotificacao(error instanceof Error ? error.message : 'Erro ao iniciar navegação', 'erro')
      setModoNavegacao(false)
      setLoading(false)
    }
  }
  
  // Função para atualizar qual é a próxima OS
  const atualizarProximaOS = () => {
    console.log("Atualizando próxima OS, ordens atendidas:", ordensAtendidas)
    console.log("Status interno das ordens:", statusOrdens)
    
    // Para depuração - lista todas as ordens e seus status
    console.log("Lista detalhada de todas as ordens:")
    todasOrdens.forEach(os => {
      console.log(`OS ${os.id}: Status original=${os.status || 'Não definido'}, Status interno=${statusOrdens[os.id] || 'Não definido'}, Atendida=${ordensAtendidas.includes(os.id)}`)
    });
    
    const proxima = encontrarOSMaisProxima(userLocation, todasOrdens, ordensAtendidas, statusOrdens)
    
    if (proxima) {
      console.log("Nova OS próxima encontrada:", proxima.id, proxima.description, 
                 `(Status original=${proxima.status}, Status interno=${statusOrdens[proxima.id] || 'Não definido'})`)
      
      // Verifica novamente se a OS não deveria estar marcada como concluída
      if (ordensAtendidas.includes(proxima.id) || statusOrdens[proxima.id] === 'CONCLUIDA_APP') {
        console.warn(`AVISO: A OS ${proxima.id} parece estar marcada como concluída mas foi selecionada como próxima. Tentando encontrar outra OS.`);
        
        // Tenta encontrar outra OS que definitivamente não esteja concluída
        const osDisponíveis = todasOrdens.filter(os => 
          !ordensAtendidas.includes(os.id) && 
          statusOrdens[os.id] !== 'CONCLUIDA_APP'
        );
        
        if (osDisponíveis.length > 0) {
          // Ordena por distância e pega a mais próxima
          if (userLocation) {
            const comDistancia = osDisponíveis.map(os => ({
              ...os,
              dist: calcularDistancia(userLocation.lat, userLocation.lng, os.lat, os.lng)
            }));
            
            const maisPróxima = comDistancia.sort((a, b) => a.dist - b.dist)[0];
            console.log(`Usando OS alternativa: ${maisPróxima.id} - ${maisPróxima.description}`);
            setOsProxima(maisPróxima);
            
            // Exibe rota para a OS alternativa
            if (modoNavegacao && map && routeLayer) {
              exibirRotaNoMapa(map, routeLayer, userLocation, maisPróxima)
                .then(sucesso => {
                  if (sucesso) {
                    mostrarNotificacao(`Rota para ${maisPróxima.description} atualizada`, 'info');
                  }
                });
            }
            return;
          }
        } else {
          console.log("Não há mais ordens disponíveis para atendimento");
          setOsProxima(null);
          mostrarNotificacao('Todas as ordens de serviço foram concluídas!', 'sucesso');
          return;
        }
      }
      
      // Se chegou aqui, usa a OS encontrada
      setOsProxima(proxima)
      
      // NOVA FUNCIONALIDADE: Exibe a rota para a próxima OS se estiver em modo navegação
      if (modoNavegacao && map && routeLayer && userLocation) {
        exibirRotaNoMapa(map, routeLayer, userLocation, proxima)
          .then(sucesso => {
            if (sucesso) {
              mostrarNotificacao(`Rota para ${proxima.description} atualizada`, 'info');
            }
          });
      }
    } else if (ordensAtendidas.length > 0) {
      // Todas as ordens foram atendidas
      mostrarNotificacao('Parabéns! Você concluiu todas as ordens de serviço.', 'sucesso')
      setModoNavegacao(false)
      setOsProxima(null)
    }
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
          
          // NOVA FUNCIONALIDADE: Atualiza a rota à medida que o usuário se move
          if (map && routeLayer && osProxima) {
            // Só atualiza a cada 5 segundos para não sobrecarregar
            const agora = Date.now();
            if (!window.ultimaAtualizacaoRota || agora - window.ultimaAtualizacaoRota > 5000) {
              window.ultimaAtualizacaoRota = agora;
              
              exibirRotaNoMapa(map, routeLayer, {
                lat: latitude,
                lng: longitude,
                accuracy
              }, osProxima);
            }
          }
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
  }, [modoNavegacao, osProxima, map, routeLayer])
  
  // Adiciona event listeners para os eventos personalizados
  useEffect(() => {
    const handleOSConcluida = (e: CustomEvent<{ id: string }>) => {
      console.log('Evento os-concluida recebido para OS:', e.detail.id);
      marcarOSComoConcluida(e.detail.id);
    };
    
    const handleNavegarParaOS = (e: CustomEvent<{ lat: number, lng: number, id: string }>) => {
      const os = todasOrdens.find(o => o.id === e.detail.id) || {
        lat: e.detail.lat,
        lng: e.detail.lng
      };
      navegarParaGoogleMaps(userLocation, os);
    };
    
    window.addEventListener('os-concluida', handleOSConcluida as EventListener);
    window.addEventListener('navigate-to-order', handleNavegarParaOS as EventListener);
    
    return () => {
      window.removeEventListener('os-concluida', handleOSConcluida as EventListener);
      window.removeEventListener('navigate-to-order', handleNavegarParaOS as EventListener);
    };
  }, [todasOrdens, userLocation, ordensAtendidas]);
  
  // Botão para solicitar permissão de localização
  const solicitarPermissaoLocalizacao = () => {
    // Verificamos se temos acesso à ponte de APIs nativas
    if (window.CordovaBridge && window.CordovaBridge.Permissions) {
      console.log('Solicitando permissão via ponte nativa');
      
      window.CordovaBridge.Permissions.requestLocation()
        .then(() => {
          console.log('Permissão concedida via ponte nativa');
          localStorage.setItem('locationPermissionGranted', 'true');
          
          // Obtém a localização após permissão concedida
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const novaLoc = {
                lat: position.coords.latitude,
                lng: position.coords.longitude,
                accuracy: position.coords.accuracy
              };
              
              console.log('Permissão concedida, nova localização:', novaLoc);
              setUserLocation(novaLoc);
              
              // Exibe mensagem de sucesso
              mostrarNotificacao('Localização obtida com sucesso!', 'success');
            },
            (error) => {
              console.error('Erro ao obter localização:', error);
              mostrarNotificacao('Erro ao obter localização. Verifique se o GPS está ativado.', 'error');
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 0
            }
          );
        })
        .catch((error) => {
          console.error('Erro ao solicitar permissão via ponte nativa:', error);
          localStorage.setItem('locationPermissionGranted', 'false');
          
          // Se a permissão for negada, oferecemos abrir as configurações
          if (confirm('É necessário permitir acesso à localização. Deseja abrir as configurações do aplicativo?')) {
            window.CordovaBridge.Permissions.openAppSettings();
          }
        });
    } else {
      // Fallback para API padrão do navegador
      if (!navigator.geolocation) {
        alert('Seu navegador não suporta geolocalização!');
        return;
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const novaLoc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          };
          
          console.log('Permissão concedida, nova localização:', novaLoc);
          localStorage.setItem('locationPermissionGranted', 'true');
          setUserLocation(novaLoc);
          
          // Exibe mensagem de sucesso
          mostrarNotificacao('Localização obtida com sucesso!', 'success');
        },
        (error) => {
          console.error('Erro ao obter localização:', error);
          localStorage.setItem('locationPermissionGranted', 'false');
          
          // Se a permissão foi negada, redireciona para a página de permissão
          if (error.code === 1) { // PERMISSION_DENIED
            if (confirm('É necessário permitir acesso à localização. Deseja ir para a página de permissão?')) {
              window.location.href = '/location-permission.html';
            }
          } else {
            mostrarNotificacao('Erro ao obter localização. Verifique se o GPS está ativado.', 'error');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    }
  };

  return (
    <div className="h-screen flex flex-col relative">
      {/* Popup de permissão de localização - Renderizado FORA da hierarquia normal do DOM */}
      {mostrarPopupLocalizacao && !userLocation && ReactDOM.createPortal(
        <PermissaoLocalizacao
          onPermitir={handleObterLocalizacao}
          onNegar={handleContinuarSemLocalizacao}
        />,
        document.body // Renderiza diretamente no body para evitar problemas de z-index
      )}
      
      {/* Cabeçalho */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-900 shadow-lg relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <h1 className="text-xl font-semibold text-white">Sistema de Ordens de Serviço</h1>
            </div>
            <div className="flex items-center">
                          <div className="mr-4 px-3 py-1.5 bg-blue-800 rounded-md text-sm text-white flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span>
                {stats.ordersCount} ordens
                {modoNavegacao && ordensAtendidas.length > 0 && (
                  <span className="ml-1 text-green-300">({ordensAtendidas.length} concluídas)</span>
                )}
              </span>
            </div>
            
            {/* Botão para ativar/atualizar localização */}
            <button
              onClick={solicitarPermissaoLocalizacao}
              className="mr-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {userLocation ? 'Atualizar GPS' : 'Ativar GPS'}
            </button>
            
            <button
              onClick={onLogout}
              className="px-3 py-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex items-center shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sair
            </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Barra de ferramentas */}
      <div className="bg-white border-b shadow-sm relative z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between">
          <div className="flex flex-wrap items-center space-x-2">
            {!modoNavegacao ? (
              <>
                <button
                  onClick={handleIniciarNavegacao}
                  disabled={loading}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm flex items-center transition-colors shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm flex items-center transition-colors shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
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
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm flex items-center transition-colors shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Encerrar Navegação
                </button>
              </>
            )}
            
            <button
              onClick={() => setMostrarListaOS(!mostrarListaOS)}
              className={`${mostrarListaOS ? 'bg-blue-700' : 'bg-blue-600'} hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm flex items-center transition-colors shadow-sm`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
              {mostrarListaOS ? 'Ocultar Lista' : 'Ver Lista'}
            </button>
          </div>
          
          {optimizedRoute && stats.routeDistance > 0 && (
            <div className="px-3 py-1.5 bg-gray-100 rounded-md text-sm text-gray-700 font-medium flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              Rota: <span className="ml-1 text-blue-700">{stats.routeDistance.toFixed(1)} km</span> <span className="mx-1">•</span> <span className="text-blue-700">{stats.routeDuration.toFixed(0)} min</span>
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
          <Spinner 
            fullScreen 
            withBackdrop 
            size="lg" 
            label="Carregando..." 
          />
        )}
      </div>
    </div>
  )
} 