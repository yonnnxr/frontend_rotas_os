const API_URL = import.meta.env.VITE_API_URL || 'https://backend-rotas-os.onrender.com';
let map = null;
let markersLayer = null;

// Função para fazer login
async function login(teamCode) {
    try {
        const response = await fetch(`${API_URL}/validate-team`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ team_code: teamCode })
        });

        if (!response.ok) {
            throw new Error('Código de equipe inválido');
        }

        const data = await response.json();
        // Armazena os dados da equipe e o token JWT
        localStorage.setItem('token', data.token);
        localStorage.setItem('team_code', teamCode);
        localStorage.setItem('team_name', data.name);
        localStorage.setItem('team_id', data.id);
        
        // Atualiza a interface
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('map-container').classList.remove('hidden');
        
        // Atualiza a informação da equipe na interface
        const teamInfoElement = document.getElementById('team-info');
        if (teamInfoElement) {
            teamInfoElement.textContent = `Equipe: ${data.name}`;
        }
        
        initMap();
        loadOrders();
    } catch (error) {
        console.error('Erro de login:', error);
        alert(error.message || 'Erro ao fazer login. Tente novamente.');
    }
}

// Função para fazer logout
function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('team_code');
    localStorage.removeItem('team_name');
    localStorage.removeItem('team_id');
    
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
    
    map = L.map('map').setView([-23.550520, -46.633308], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
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

        // Usa a rota específica da equipe para garantir segurança
        let url = `${API_URL}/api/teams/${teamId}/geojson`;

        console.log(`Carregando ordens da equipe ${teamId}...`);
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
            
            // Se a rota específica falhar, tenta a rota alternativa (que também está protegida)
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
    
    // Adiciona os dados ao mapa
    const geoJsonLayer = L.geoJSON(geojsonData, {
        pointToLayer: (feature, latlng) => {
            // Usa a propriedade situacao para determinar a cor (se disponível)
            let color = 'red';
            const situacao = feature.properties.situacao || 
                             feature.properties.status || 
                             'pendente';
            
            if (situacao.toLowerCase().includes('exec')) {
                color = 'green';
            } else if (situacao.toLowerCase().includes('prog')) {
                color = 'orange';
            }
            
            return L.circleMarker(latlng, {
                radius: 8,
                fillColor: color,
                color: '#fff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
            });
        },
        onEachFeature: (feature, layer) => {
            const props = feature.properties;
            // Adapta para diferentes formatos de dados
            const ordemServico = props.ordem_servico || props.nroos || 'N/A';
            const status = props.status || props.situacao || 'Pendente';
            const equipe = props.equipe || props.equipeexec || localStorage.getItem('team_name');
            
            layer.bindPopup(`
                <strong>OS:</strong> ${ordemServico}<br>
                <strong>Status:</strong> ${status}<br>
                <strong>Equipe:</strong> ${equipe}
            `);
        }
    }).addTo(markersLayer);
    
    // Ajusta o zoom para mostrar todos os pontos
    try {
        const bounds = geoJsonLayer.getBounds();
        if (bounds && bounds.isValid()) {
            map.fitBounds(bounds);
        } else {
            // Se não conseguir obter bounds válidos, usa uma localização padrão
            map.setView([-23.550520, -46.633308], 12);
        }
    } catch (error) {
        console.error('Erro ao ajustar o zoom do mapa:', error);
        // Em caso de erro, usa uma localização padrão
        map.setView([-23.550520, -46.633308], 12);
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