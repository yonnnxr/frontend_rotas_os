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
  // Validação inicial de segurança
  if (!geojsonData || !geojsonData.features || !Array.isArray(geojsonData.features)) {
    console.error('Dados GeoJSON inválidos:', geojsonData);
    return [];
  }
  
  console.log(`Processando ${geojsonData.features.length} features do GeoJSON`);
  
  // Filtra apenas os pontos (ordens)
  const orderFeatures = geojsonData.features.filter(feature => 
    feature.geometry && feature.geometry.type === 'Point'
  );
  
  console.log(`Encontradas ${orderFeatures.length} features do tipo Point`);
  
  if (orderFeatures.length > 0) {
    // Log da primeira feature para debug
    console.log('Exemplo de feature:', JSON.stringify(orderFeatures[0], null, 2).substring(0, 500));
    console.log('Propriedades disponíveis:', orderFeatures[0].properties ? Object.keys(orderFeatures[0].properties) : 'Nenhuma propriedade');
  }
  
  // Mapeia para o formato de OSPoint
  const ordens = orderFeatures.map((feature, index) => {
    try {
      if (!feature.geometry || !feature.geometry.coordinates || !Array.isArray(feature.geometry.coordinates)) {
        console.warn(`Feature #${index} com geometria inválida:`, feature);
        return null;
      }
      
      const coords = feature.geometry.coordinates as number[];
      const props = feature.properties || {};
      
      // Extração de ID com logs e fallbacks
      let id = '';
      if (props.id) {
        id = String(props.id);
      } else if (props.ordem_servico) {
        id = String(props.ordem_servico);
      } else if (props.nroos) {
        id = String(props.nroos);
      } else if (props.os_id) {
        id = String(props.os_id);
      } else {
        // Fallback: usar índice se não tiver ID
        id = `ordem_${index}`;
        console.warn(`Feature #${index} sem ID, usando '${id}' como fallback`);
      }
      
      // Corrigir coordenadas (se disponível)
      const corrigeCoordenadas = (longitude: number, latitude: number) => {
        try {
          // Verificar se a função corrigirCoordenadas está disponível
          if (typeof corrigirCoordenadas === 'function') {
            return corrigirCoordenadas(longitude, latitude);
          } else {
            // Fallback: ajuste para Anastácio/MS (deslocamento de 12 graus para oeste)
            return { lat: latitude, lng: longitude - 12 };
          }
        } catch (error) {
          console.error(`Erro ao corrigir coordenadas [${longitude}, ${latitude}]:`, error);
          return { lat: latitude, lng: longitude };
        }
      };
      
      const { lat, lng } = corrigeCoordenadas(coords[0], coords[1]);
      
      // Extrair descrição com fallbacks
      const description = 
        props.descricao || 
        props.ordem_servico || 
        props.nroos || 
        props.descricao_servico || 
        `OS ${index + 1}`;
      
      // Extrair status com fallbacks
      const status = 
        props.situacao || 
        props.status || 
        props.estado || 
        'Pendente';
      
      // Registra o que foi encontrado para debug
      if (index === 0 || index === orderFeatures.length - 1) {
        console.log(`OS #${index} processada:`, { id, lat, lng, description, status });
      }
      
      return {
        lat,
        lng,
        order: props.route_order || props.ordem || index + 1,
        id,
        description,
        feature,
        status
      };
    } catch (error) {
      console.error(`Erro ao processar feature #${index}:`, error);
      return null;
    }
  }).filter(Boolean) as OSPoint[]; // Remove itens nulos
  
  console.log(`Processamento concluído: ${ordens.length} ordens válidas extraídas de ${orderFeatures.length} features`);
  // Log dos primeiros IDs para debug
  if (ordens.length > 0) {
    console.log('IDs das primeiras 5 ordens:', ordens.slice(0, 5).map(o => o.id));
  }
  
  return ordens;
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