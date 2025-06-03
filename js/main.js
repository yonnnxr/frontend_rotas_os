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
    
    // Coordenadas iniciais aproximadas para Mato Grosso do Sul (Anastácio)
    // Será ajustado quando as ordens de serviço forem carregadas
    map = L.map('map').setView([-20.475711354063041, -43.808074696354296], 10);
    
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
    console.log('Coordenadas das ordens:');
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
            
            // Verifica o tipo de coordenadas
            const coords = feature.geometry.coordinates;
            
            // Verifica se as coordenadas fazem sentido para Anastácio/MS
            // Latitude de Anastácio: aproximadamente -20.48
            // Longitude de Anastácio: aproximadamente -55.80
            
            // No GeoJSON, o formato é [longitude, latitude]
            let lat, lng;
            
            // Verifica se as coordenadas estão invertidas ou em região incorreta
            // Se a primeira coordenada parece uma latitude no Brasil (-10 a -30)
            // e a segunda parece uma longitude no Brasil (-35 a -75)
            if (coords[0] >= -30 && coords[0] <= -10 && 
                coords[1] >= -75 && coords[1] <= -35) {
                // Coordenadas estão invertidas - corrige
                console.log(`Coordenadas invertidas detectadas: [${coords}], corrigindo...`);
                lat = coords[0];  // Primeira coordenada é latitude
                lng = coords[1];  // Segunda coordenada é longitude
            } else {
                // Formato padrão GeoJSON [longitude, latitude]
                lng = coords[0];
                lat = coords[1];
                
                // Verifica se parece estar na região de Mato Grosso do Sul
                const distanciaAnastacio = Math.sqrt(
                    Math.pow(lat - (-20.48), 2) + 
                    Math.pow(lng - (-55.80), 2)
                );
                
                // Se estiver muito distante (>5 graus), pode estar incorreto
                if (distanciaAnastacio > 5) {
                    console.warn(
                        `Coordenada suspeita: [${lng},${lat}], ` +
                        `distância de Anastácio: ${distanciaAnastacio.toFixed(2)} graus`
                    );
                }
            }
            
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
            
            let coordsInfo = `<strong>Coordenadas:</strong> [${lat.toFixed(6)}, ${lng.toFixed(6)}]<br>`;
            
            marker.bindPopup(`
                <strong>OS:</strong> ${ordemServico}<br>
                <strong>Status:</strong> ${status}<br>
                <strong>Equipe:</strong> ${equipe}<br>
                ${endereco}
                ${localidade}
                ${coordsInfo}
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
            console.log('Ajustando visualização para os pontos...');
            // Tenta usar os pontos coletados
            map.fitBounds(L.latLngBounds(points));
        } catch (error) {
            console.error('Erro ao ajustar bounds:', error);
            
            // Fallback: foca em Anastácio
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