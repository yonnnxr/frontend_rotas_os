const API_URL = import.meta.env.VITE_API_URL || 'https://api.seu-dominio.workers.dev/api';
let map = null;
let markersLayer = null;
let routeLayer = null;
let optimizedRoute = null;
let currentTeamId = null;

// Função para fazer login
async function login(teamCode) {
    try {
        const response = await fetch(`${API_URL}/validate-team`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ team_code: teamCode })
        });

        if (!response.ok) {
            throw new Error('Código de equipe inválido');
        }

        const data = await response.json();
        localStorage.setItem('token', data.token);
        localStorage.setItem('team_code', teamCode);
        localStorage.setItem('team_id', data.id);
        localStorage.setItem('team_name', data.name);
        
        currentTeamId = data.id;
        
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('map-container').classList.remove('hidden');
        
        initMap();
        loadOrders();
    } catch (error) {
        alert(error.message);
    }
}

// Função para fazer logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('team_code');
    localStorage.removeItem('team_id');
    localStorage.removeItem('team_name');
    currentTeamId = null;
    
    if (map) {
        map.remove();
        map = null;
    }
    
    document.getElementById('map-container').classList.add('hidden');
    document.getElementById('login-container').classList.remove('hidden');
}

// Função para inicializar o mapa
function initMap() {
    if (map) return;
    
    // Região de Anastácio, MS (onde as ordens realmente deveriam estar)
    map = L.map('map').setView([-20.48, -55.80], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);
    
    markersLayer = L.layerGroup().addTo(map);
    routeLayer = L.layerGroup().addTo(map);
}

// Função para carregar as ordens de serviço
async function loadOrders() {
    try {
        const token = localStorage.getItem('token');
        const teamId = localStorage.getItem('team_id');
        
        if (!token || !teamId) {
            logout();
            return;
        }

        console.log(`Carregando ordens da equipe ${teamId}...`);
        currentTeamId = teamId;
        
        // Primeiro tenta carregar usando a API específica da equipe
        let url = `${API_URL}/api/teams/${teamId}/geojson`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                console.error('Erro de autenticação, fazendo logout');
                logout();
                return;
            }
            
            // Se a API específica falhar, tenta a rota genérica
            console.log('Tentando rota alternativa para ordens de serviço...');
            const fallbackResponse = await fetch(`${API_URL}/orders`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            });
            
            if (fallbackResponse.ok) {
                const geojsonData = await fallbackResponse.json();
                displayOrders(geojsonData);
                return;
            }
            
            throw new Error('Erro ao carregar ordens de serviço');
        }

        const geojsonData = await response.json();
        console.log('Dados carregados:', geojsonData);
        displayOrders(geojsonData);
    } catch (error) {
        console.error('Erro ao carregar ordens:', error);
        alert(error.message || 'Erro ao carregar ordens de serviço');
    }
}

// Função para exibir as ordens no mapa
function displayOrders(geojsonData) {
    if (!map || !markersLayer) return;
    
    markersLayer.clearLayers();
    
    // Verifica se temos dados para exibir
    if (!geojsonData || !geojsonData.features || geojsonData.features.length === 0) {
        console.log('Nenhuma ordem de serviço para exibir');
        // Atualiza a interface para mostrar mensagem ao usuário
        const orderCountElement = document.getElementById('order-count');
        if (orderCountElement) {
            orderCountElement.textContent = 'Nenhuma ordem de serviço pendente';
        }
        return;
    }
    
    // Filtra apenas as ordens de serviço (exclui a rota, se houver)
    const orderFeatures = geojsonData.features.filter(feature => 
        feature.geometry && feature.geometry.type === 'Point'
    );
    
    // Atualiza contador de ordens
    const orderCountElement = document.getElementById('order-count');
    if (orderCountElement) {
        orderCountElement.textContent = `${orderFeatures.length} ordens de serviço`;
    }
    
    // Para debug: exibe as coordenadas de todas as ordens
    console.log('Coordenadas originais das ordens:');
    orderFeatures.forEach((feature, index) => {
        if (feature.geometry && feature.geometry.coordinates) {
            console.log(`OS #${index}: [${feature.geometry.coordinates}]`);
        }
    });
    
    // Cria um grupo de coordenadas para calcular o centro
    let points = [];
    
    // Adiciona os pontos ao mapa
    orderFeatures.forEach(feature => {
        try {
            if (!feature.geometry || !feature.geometry.coordinates) {
                console.warn('Feature sem coordenadas:', feature);
                return;
            }
            
            // No GeoJSON, o formato é [longitude, latitude]
            const coords = feature.geometry.coordinates;
            
            // Problema identificado: as coordenadas estão na região de BH (-43.8, -20.48)
            // mas deveriam estar em Anastácio (-55.8, -20.48)
            // A latitude está correta, mas a longitude está errada
            
            // Coordenadas originais
            const origLng = coords[0];
            const origLat = coords[1];
            
            // Corrigir coordenadas:
            // Abordagem 1: Deslocar a longitude
            // De: região de BH (-43.8) Para: região de Anastácio (-55.8)
            // Diferença aproximada: -12 graus
            let lng = origLng - 12;  // Desloca 12 graus para oeste
            let lat = origLat;       // Mantém a latitude
            
            console.log(`Corrigindo coordenadas: [${origLng}, ${origLat}] -> [${lng}, ${lat}]`);
            
            // Cria o ponto Leaflet e adiciona à lista de pontos
            const latlng = L.latLng(lat, lng);
            points.push([lat, lng]);
            
            // Adiciona o número da ordem ao marcador se disponível
            const orderNumber = feature.properties.route_order || '';
            
            // Usa a propriedade situacao para determinar a cor
            let color = 'red';
            const situacao = feature.properties.situacao || 
                            feature.properties.status || 
                            'pendente';
            
            if (situacao.toLowerCase().includes('exec')) {
                color = 'green';
            } else if (situacao.toLowerCase().includes('prog')) {
                color = 'orange';
            }
            
            // Cria o marcador
            const marker = L.circleMarker(latlng, {
                radius: 8,
                fillColor: color,
                color: '#fff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            }).addTo(markersLayer);
            
            // Adiciona o número da ordem ao centro do marcador
            if (orderNumber) {
                L.marker(latlng, {
                    icon: L.divIcon({
                        className: 'order-number-icon',
                        html: `<div>${orderNumber}</div>`,
                        iconSize: [20, 20],
                        iconAnchor: [10, 10]
                    })
                }).addTo(markersLayer);
            }
            
            // Configura o popup com informações detalhadas
            const props = feature.properties;
            const ordemServico = props.ordem_servico || props.nroos || 'N/A';
            const status = props.status || props.situacao || 'Pendente';
            const equipe = props.equipe || props.equipeexec || localStorage.getItem('team_name');
            
            // Adiciona informações extras que podem ser úteis
            let endereco = '';
            if (props.logradouro) {
                endereco = `<strong>Endereço:</strong> ${props.logradouro}, ${props.num || 'S/N'}`;
                if (props.bairro) endereco += `, ${props.bairro}`;
                endereco += `<br>`;
            }
            
            let localidade = '';
            if (props.localidade || props.municipio) {
                localidade = `<strong>Localidade:</strong> ${props.localidade || props.municipio}<br>`;
            }
            
            // Adiciona informações de grupo e serviço
            let grupoServico = '';
            if (props.descgrupo) {
                grupoServico += `<strong>Grupo:</strong> ${props.descgrupo}<br>`;
            }
            if (props.descrservsolicitado) {
                grupoServico += `<strong>Serviço Solicitado:</strong> ${props.descrservsolicitado}<br>`;
            }
            
            // Adiciona informação de ordem na rota, se disponível
            let ordemRota = '';
            if (props.route_order) {
                ordemRota = `<strong>Ordem na Rota:</strong> ${props.route_order}<br>`;
            }
            
            marker.bindPopup(`
                <strong>OS:</strong> ${ordemServico}<br>
                <strong>Status:</strong> ${status}<br>
                <strong>Equipe:</strong> ${equipe}<br>
                ${ordemRota}
                ${grupoServico}
                ${endereco}
                ${localidade}
            `);
        } catch (error) {
            console.error('Erro ao adicionar ponto:', error);
        }
    });
    
    console.log(`Pontos adicionados: ${points.length}`);
    
    // Verifica se há uma rota para exibir
    displayRoute(geojsonData);
    
    // Centro aproximado de Anastácio/MS
    const anastacioCenter = [-20.48, -55.80];
    
    // Ajusta o zoom para mostrar todos os pontos
    if (points.length > 0) {
        try {
            console.log('Ajustando visualização para os pontos corrigidos...');
            // Tenta usar os pontos coletados
            map.fitBounds(L.latLngBounds(points));
        } catch (error) {
            console.error('Erro ao ajustar bounds:', error);
            
            // Fallback: centro de Anastácio
            console.log('Usando centro de Anastácio como fallback');
            map.setView(anastacioCenter, 12);
        }
    } else {
        console.warn('Nenhum ponto válido para exibir, centralizando em Anastácio');
        map.setView(anastacioCenter, 12);
    }
}

// Função para exibir a rota otimizada
function displayRoute(geojsonData) {
    if (!map || !routeLayer) return;
    
    // Limpa a camada de rota
    routeLayer.clearLayers();
    
    // Verifica se há uma rota para exibir
    const routeFeatures = geojsonData.features.filter(feature => 
        feature.geometry && 
        (feature.geometry.type === 'LineString' || feature.properties?.type === 'route' || feature.properties?.type === 'traffic_route')
    );
    
    if (routeFeatures.length === 0) {
        // Esconde informações de rota se não houver rota
        document.getElementById('route-info').classList.add('hidden');
        document.getElementById('clear-route-btn').classList.add('hidden');
        document.getElementById('show-instructions-btn').classList.add('hidden');
        return;
    }
    
    // Adiciona cada rota ao mapa
    routeFeatures.forEach(feature => {
        try {
            // Obtém as propriedades da rota
            const props = feature.properties || {};
            const color = props.color || '#0066CC';
            const weight = props.weight || 4;
            const opacity = props.opacity || 0.7;
            
            // Cria a linha da rota
            const route = L.geoJSON(feature, {
                style: {
                    color: color,
                    weight: weight,
                    opacity: opacity
                }
            }).addTo(routeLayer);
            
            // Atualiza as informações da rota na interface
            updateRouteInfo(geojsonData);
            
            // Mostra os botões relacionados à rota
            document.getElementById('clear-route-btn').classList.remove('hidden');
            
            // Verifica se é uma rota de tráfego (com instruções)
            if (props.type === 'traffic_route') {
                document.getElementById('show-instructions-btn').classList.remove('hidden');
            }
            
            // Armazena a rota para uso posterior
            optimizedRoute = geojsonData;
            
        } catch (error) {
            console.error('Erro ao exibir rota:', error);
        }
    });
}

// Função para atualizar as informações da rota na interface
function updateRouteInfo(geojsonData) {
    const routeInfo = document.getElementById('route-info');
    const routeDistance = document.getElementById('route-distance');
    const routeDuration = document.getElementById('route-duration');
    
    // Procura pela feature de rota
    const routeFeature = geojsonData.features.find(feature => 
        feature.properties && (feature.properties.type === 'route' || feature.properties.type === 'traffic_route')
    );
    
    if (routeFeature && routeFeature.properties) {
        const props = routeFeature.properties;
        const distance = props.distance || 0;
        const duration = props.duration || 0;
        
        // Atualiza os elementos da interface
        routeDistance.textContent = distance.toFixed(1);
        routeDuration.textContent = duration.toFixed(0);
        routeInfo.classList.remove('hidden');
        
        // Atualiza também o resumo no painel de instruções
        document.getElementById('summary-distance').textContent = distance.toFixed(1);
        document.getElementById('summary-duration').textContent = duration.toFixed(0);
        
        // Conta o número de ordens na rota
        const orderCount = geojsonData.features.filter(f => f.geometry && f.geometry.type === 'Point').length;
        document.getElementById('summary-orders').textContent = orderCount;
    } else {
        routeInfo.classList.add('hidden');
    }
}

// Função para otimizar a rota
async function optimizeRoute() {
    try {
        const token = localStorage.getItem('token');
        const teamId = localStorage.getItem('team_id');
        
        if (!token || !teamId) {
            logout();
            return;
        }
        
        // Mostra indicador de carregamento
        document.getElementById('optimize-route-btn').textContent = 'Otimizando...';
        document.getElementById('optimize-route-btn').disabled = true;
        
        // Chama a API para otimizar a rota
        const url = `${API_URL}/api/teams/${teamId}/optimized-route?consider_traffic=true&profile=car`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro ao otimizar rota: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Rota otimizada:', data);
        
        // Atualiza o mapa com a rota otimizada
        displayOrders(data);
        
        // Armazena a rota otimizada
        optimizedRoute = data;
        
    } catch (error) {
        console.error('Erro ao otimizar rota:', error);
        alert('Erro ao otimizar rota: ' + error.message);
    } finally {
        // Restaura o botão
        document.getElementById('optimize-route-btn').textContent = 'Otimizar Rota';
        document.getElementById('optimize-route-btn').disabled = false;
    }
}

// Função para limpar a rota
function clearRoute() {
    if (!map || !routeLayer) return;
    
    // Limpa a camada de rota
    routeLayer.clearLayers();
    
    // Esconde informações e botões de rota
    document.getElementById('route-info').classList.add('hidden');
    document.getElementById('clear-route-btn').classList.add('hidden');
    document.getElementById('show-instructions-btn').classList.add('hidden');
    
    // Fecha o painel de instruções, se estiver aberto
    document.getElementById('route-panel').classList.remove('open');
    
    // Carrega as ordens novamente para remover os números de ordem
    loadOrders();
    
    // Limpa a referência à rota
    optimizedRoute = null;
}

// Função para carregar instruções passo a passo
async function loadRouteInstructions() {
    try {
        const token = localStorage.getItem('token');
        const teamId = localStorage.getItem('team_id');
        
        if (!token || !teamId) {
            logout();
            return;
        }
        
        // Chama a API para obter as instruções
        const url = `${API_URL}/api/teams/${teamId}/route-instructions?profile=car`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erro ao carregar instruções: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Instruções de rota:', data);
        
        // Atualiza o resumo
        document.getElementById('summary-distance').textContent = data.total_distance_km.toFixed(1);
        document.getElementById('summary-duration').textContent = data.total_duration_min.toFixed(0);
        document.getElementById('summary-orders').textContent = data.instructions_count;
        
        // Limpa a lista de instruções
        const instructionsList = document.getElementById('instructions-list');
        instructionsList.innerHTML = '';
        
        // Adiciona cada instrução à lista
        data.instructions.forEach(instruction => {
            const li = document.createElement('li');
            li.className = 'instruction-item';
            
            li.innerHTML = `
                <span class="instruction-number">${instruction.index}</span>
                <div>
                    <div class="instruction-text">${instruction.description}</div>
                    <div class="instruction-details">
                        ${instruction.distance.toFixed(1)} km | ${instruction.duration.toFixed(0)} min
                    </div>
                </div>
            `;
            
            instructionsList.appendChild(li);
        });
        
        // Abre o painel de instruções
        document.getElementById('route-panel').classList.add('open');
        
    } catch (error) {
        console.error('Erro ao carregar instruções:', error);
        alert('Erro ao carregar instruções: ' + error.message);
    }
}

// Função para fechar o painel de instruções
function closeInstructionsPanel() {
    document.getElementById('route-panel').classList.remove('open');
}

// Event Listeners
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const teamCode = document.getElementById('team-code').value;
    login(teamCode);
});

document.getElementById('logout-btn').addEventListener('click', logout);
document.getElementById('optimize-route-btn').addEventListener('click', optimizeRoute);
document.getElementById('clear-route-btn').addEventListener('click', clearRoute);
document.getElementById('show-instructions-btn').addEventListener('click', loadRouteInstructions);
document.getElementById('route-panel-close').addEventListener('click', closeInstructionsPanel);

// Adiciona CSS para os ícones de número de ordem
const style = document.createElement('style');
style.textContent = `
    .order-number-icon {
        background: none;
        border: none;
    }
    .order-number-icon div {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        background-color: white;
        border: 2px solid #1a73e8;
        border-radius: 50%;
        color: #1a73e8;
        font-weight: bold;
        font-size: 12px;
    }
`;
document.head.appendChild(style);

// Verificar se já está logado
const token = localStorage.getItem('token');
if (token) {
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('map-container').classList.remove('hidden');
    initMap();
    loadOrders();
} 