import React from 'react';
import { OSPoint } from '../types';
import { calcularDistancia } from '../utils/geoUtils';

interface OSListProps {
  ordens: OSPoint[];
  ordensAtendidas: string[];
  osProximaId: string | null;
  userLat?: number;
  userLng?: number;
  onSelectOS: (os: OSPoint) => void;
  onConcluirOS: (id: string) => void;
}

const OSList: React.FC<OSListProps> = ({
  ordens, 
  ordensAtendidas, 
  osProximaId,
  userLat, 
  userLng,
  onSelectOS,
  onConcluirOS
}) => {
  // Ordena as ordens de serviço pela distância (se userLat e userLng estiverem disponíveis)
  const ordensSorted = [...ordens].sort((a, b) => {
    // Primeiro, ordena por status (pendentes primeiro)
    const aAtendida = ordensAtendidas.includes(a.id);
    const bAtendida = ordensAtendidas.includes(b.id);
    
    if (aAtendida && !bAtendida) return 1;
    if (!aAtendida && bAtendida) return -1;
    
    // Se ambas têm o mesmo status, ordena por distância se possível
    if (userLat && userLng) {
      const distA = calcularDistancia(userLat, userLng, a.lat, a.lng);
      const distB = calcularDistancia(userLat, userLng, b.lat, b.lng);
      return distA - distB;
    }
    
    // Se não tiver localização, ordena por número de ordem
    return a.order - b.order;
  });
  
  if (ordensSorted.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        Nenhuma ordem de serviço disponível
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50">
        <h3 className="text-lg font-medium">Ordens de Serviço</h3>
        <p className="text-sm text-gray-500">
          {ordensSorted.length} ordens | {ordensAtendidas.length} concluídas
        </p>
      </div>
      
      <div className="max-h-[60vh] overflow-y-auto">
        {ordensSorted.map(os => {
          const isAtendida = ordensAtendidas.includes(os.id);
          const isProxima = os.id === osProximaId;
          
          // Calcular distância se tiver localização
          let distanceText = '';
          if (userLat && userLng) {
            const dist = calcularDistancia(userLat, userLng, os.lat, os.lng);
            distanceText = `${dist.toFixed(1)} km`;
          }
          
          return (
            <div 
              key={os.id}
              className={`px-4 py-3 border-b flex items-center ${
                isAtendida ? 'bg-green-50' : isProxima ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center">
                  <span 
                    className={`flex-shrink-0 w-3 h-3 rounded-full mr-2 ${
                      isAtendida ? 'bg-green-500' : isProxima ? 'bg-blue-500' : 'bg-gray-300'
                    }`}
                  />
                  <p className="font-medium truncate">
                    {os.description}
                    {os.order > 0 && <span className="ml-1 text-gray-500">#{os.order}</span>}
                  </p>
                </div>
                
                {distanceText && (
                  <p className="text-sm text-gray-500 mt-1">
                    {isProxima ? '🎯 ' : ''}{distanceText}
                  </p>
                )}
              </div>
              
              <div className="flex space-x-2 ml-2">
                {!isAtendida && (
                  <>
                    <button
                      onClick={() => onSelectOS(os)}
                      className="px-2 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                    >
                      Navegar
                    </button>
                    <button
                      onClick={() => onConcluirOS(os.id)}
                      className="px-2 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                    >
                      Concluir
                    </button>
                  </>
                )}
                {isAtendida && (
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-sm rounded">
                    Concluída
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OSList; 