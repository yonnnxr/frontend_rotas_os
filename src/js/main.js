import L from 'leaflet';
import axios from 'axios';

const API_URL = process.env.VITE_API_URL;
let map = null;
let currentMarkers = [];

// Função para salvar o token no localStorage
const saveToken = (token) => {
    localStorage.setItem('token', token);
};

// Função para recuperar o token do localStorage
const getToken = () => {
    return localStorage.getItem('token');
};

// Configuração do cliente axios com interceptor para token
const api = axios.create({
    baseURL: API_URL
});

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Inicialização do mapa
const initializeMap = () => {
    if (!map) {
        map = L.map('map').setView([-23.550520, -46.633308], 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(map);
    }
};

// Função para exibir as ordens de serviço no mapa
const displayOrders = async () => {
    try {
        const response = await api.get('/orders');
        const geojsonData = response.data;

        // Limpa marcadores existentes
        currentMarkers.forEach(marker => marker.remove());
        currentMarkers = [];

        // Adiciona novos marcadores
        geojsonData.features.forEach(feature => {
            const coords = feature.geometry.coordinates;
            const marker = L.marker([coords[1], coords[0]])
                .bindPopup(`
                    <h3>Ordem de Serviço</h3>
                    <p>Equipe: ${feature.properties.equipe}</p>
                    <p>Status: ${feature.properties.status || 'Pendente'}</p>
                `)
                .addTo(map);
            currentMarkers.push(marker);
        });

        // Ajusta o zoom para mostrar todos os marcadores
        if (currentMarkers.length > 0) {
            const group = L.featureGroup(currentMarkers);
            map.fitBounds(group.getBounds());
        }
    } catch (error) {
        console.error('Erro ao carregar ordens:', error);
        alert('Erro ao carregar as ordens de serviço');
    }
};

// Função para otimizar a rota
const optimizeRoute = async () => {
    try {
        const response = await api.post('/optimize-route');
        // TODO: Implementar exibição da rota otimizada
        console.log('Rota otimizada:', response.data);
    } catch (error) {
        console.error('Erro ao otimizar rota:', error);
        alert('Erro ao otimizar a rota');
    }
};

// Handler do formulário de login
const handleLogin = async (e) => {
    e.preventDefault();
    const teamCode = document.getElementById('team-code').value;

    try {
        const response = await api.post('/validate-team', { team_code: teamCode });
        const { token } = response.data;
        
        saveToken(token);
        
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('map-container').classList.remove('hidden');
        
        initializeMap();
        await displayOrders();
    } catch (error) {
        console.error('Erro no login:', error);
        alert('Código de equipe inválido ou erro no servidor');
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', handleLogin);

    // Verifica se já existe um token salvo
    const token = getToken();
    if (token) {
        document.getElementById('login-container').classList.add('hidden');
        document.getElementById('map-container').classList.remove('hidden');
        initializeMap();
        displayOrders();
    }
}); 