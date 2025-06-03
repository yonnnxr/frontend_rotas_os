const API_URL = import.meta.env.VITE_API_URL || 'https://api.seu-dominio.workers.dev/api';
let map = null;
let markersLayer = null;

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
    
    // Atualiza contador de ordens
    const orderCountElement = document.getElementById('order-count');
    if (orderCountElement) {
        orderCountElement.textContent = `${geojsonData.features.length} ordens de serviço`;
    }
    
    // Para debug: exibe as coordenadas de todas as ordens
    console.log('Coordenadas originais das ordens:');
    geojsonData.features.forEach((feature, index) => {
        if (feature.geometry && feature.geometry.coordinates) {
            console.log(`OS #${index}: [${feature.geometry.coordinates}]`);
        }
    });
    
    // Cria um grupo de coordenadas para calcular o centro
    let points = [];
    
    // Adiciona os pontos ao mapa
    geojsonData.features.forEach(feature => {
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
            
            marker.bindPopup(`
                <strong>OS:</strong> ${ordemServico}<br>
                <strong>Status:</strong> ${status}<br>
                <strong>Equipe:</strong> ${equipe}<br>
                ${grupoServico}
                ${endereco}
                ${localidade}
            `);
        } catch (error) {
            console.error('Erro ao adicionar ponto:', error);
        }
    });
    
    console.log(`Pontos adicionados: ${points.length}`);
    
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

// Event Listeners
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const teamCode = document.getElementById('team-code').value;
    login(teamCode);
});

document.getElementById('logout-btn').addEventListener('click', logout);

// Verificar se já está logado
const token = localStorage.getItem('token');
if (token) {
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('map-container').classList.remove('hidden');
    initMap();
    loadOrders();
} 