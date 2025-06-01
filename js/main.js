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
        if (!token) {
            logout();
            return;
        }

        const response = await fetch(`${API_URL}/orders`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            if (response.status === 401) {
                logout();
                return;
            }
            throw new Error('Erro ao carregar ordens de serviço');
        }

        const geojsonData = await response.json();
        displayOrders(geojsonData);
    } catch (error) {
        alert(error.message);
    }
}

// Função para exibir as ordens no mapa
function displayOrders(geojsonData) {
    if (!map || !markersLayer) return;
    
    markersLayer.clearLayers();
    
    L.geoJSON(geojsonData, {
        pointToLayer: (feature, latlng) => {
            const status = feature.properties.status;
            const color = status === 'pendente' ? 'red' : 'green';
            
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
            layer.bindPopup(`
                <strong>OS:</strong> ${props.ordem_servico}<br>
                <strong>Status:</strong> ${props.status}<br>
                <strong>Equipe:</strong> ${props.equipe}
            `);
        }
    }).addTo(markersLayer);
    
    // Ajusta o zoom para mostrar todos os pontos
    const bounds = markersLayer.getBounds();
    if (bounds.isValid()) {
        map.fitBounds(bounds);
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