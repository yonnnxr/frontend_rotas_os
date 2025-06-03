import { GeoJSONData, OSPoint } from '../types';
import { corrigirCoordenadas } from '../utils/geoUtils';

// Classe para erros de API
export class ApiError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Função para obter URL base da API
const getApiUrl = () => {
  return import.meta.env.VITE_API_URL || 'http://localhost:5000';
};

// Função para obter headers padrão
const getHeaders = () => {
  const token = localStorage.getItem('token');
  
  if (!token) {
    throw new ApiError('Token de autenticação não encontrado', 401);
  }
  
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json'
  };
};

// Função para verificar se o token é válido
export const verificarToken = async (): Promise<boolean> => {
  try {
    const token = localStorage.getItem('token');
    const teamId = localStorage.getItem('team_id');
    
    if (!token || !teamId) {
      return false;
    }
    
    const apiUrl = getApiUrl();
    const response = await fetch(`${apiUrl}/api/auth/verify`, {
      headers: getHeaders()
    });
    
    return response.ok;
  } catch (error) {
    console.error('Erro ao verificar token:', error);
    return false;
  }
};

// Função para carregar as ordens de serviço
export const carregarOrdens = async (): Promise<GeoJSONData> => {
  try {
    const teamId = localStorage.getItem('team_id');
    
    if (!teamId) {
      throw new ApiError('ID da equipe não encontrado', 400);
    }
    
    const apiUrl = getApiUrl();
    const url = `${apiUrl}/api/teams/${teamId}/geojson`;
    
    const response = await fetch(url, {
      headers: getHeaders()
    });
    
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new ApiError('Erro de autenticação', response.status);
      }
      
      // Tenta rota alternativa
      const fallbackResponse = await fetch(`${apiUrl}/orders`, {
        headers: getHeaders()
      });
      
      if (fallbackResponse.ok) {
        return await fallbackResponse.json();
      }
      
      throw new ApiError(`Erro ao carregar ordens: ${response.status}`, response.status);
    }
    
    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      error instanceof Error ? error.message : 'Erro desconhecido ao carregar ordens',
      500
    );
  }
};

// Função para processar os dados GeoJSON e extrair as ordens
export const processarOrdens = (geojsonData: GeoJSONData): OSPoint[] => {
  // Filtra apenas os pontos (ordens)
  const orderFeatures = geojsonData.features.filter(feature => 
    feature.geometry && feature.geometry.type === 'Point'
  );
  
  // Mapeia para o formato de OSPoint
  return orderFeatures.map(feature => {
    const coords = feature.geometry.coordinates as number[];
    const { lat, lng } = corrigirCoordenadas(coords[0], coords[1]);
    
    return {
      lat,
      lng,
      order: feature.properties?.route_order || 0,
      id: feature.properties?.id || feature.properties?.ordem_servico || '',
      description: feature.properties?.ordem_servico || feature.properties?.nroos || 'OS',
      feature: feature,
      status: feature.properties?.situacao || feature.properties?.status || 'Pendente'
    };
  });
};

// Função para atualizar o status de uma ordem de serviço
export const atualizarStatusOS = async (osId: string, novoStatus: string): Promise<void> => {
  try {
    const teamId = localStorage.getItem('team_id');
    
    if (!teamId) {
      throw new ApiError('ID da equipe não encontrado', 400);
    }
    
    const apiUrl = getApiUrl();
    const url = `${apiUrl}/api/orders/${osId}/status`;
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        ...getHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: novoStatus })
    });
    
    if (!response.ok) {
      throw new ApiError(`Erro ao atualizar status: ${response.status}`, response.status);
    }
  } catch (error) {
    console.error('Erro ao atualizar status da OS:', error);
    // Não propaga o erro, apenas loga (atualização de status não é crítica)
  }
}; 