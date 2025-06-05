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
      <div className="p-6 flex flex-col items-center justify-center text-gray-500 h-full">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p className="text-lg font-medium">Nenhuma ordem de serviço disponível</p>
        <p className="text-sm mt-1">As ordens aparecerão aqui quando estiverem disponíveis</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b bg-gradient-to-r from-blue-50 to-blue-100">
        <h3 className="text-lg font-medium text-blue-900 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Ordens de Serviço
        </h3>
        <div className="flex items-center justify-between mt-1">
          <p className="text-sm text-blue-800 font-medium">
            {ordensSorted.length} ordens no total
          </p>
          <div className="flex items-center text-sm">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-800">
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1"></span>
              {ordensAtendidas.length} concluídas
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
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
              className={`px-4 py-3 border-b flex items-center transition-colors hover:bg-gray-50 ${
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
                
                <div className="flex items-center mt-1 text-sm">
                  <div className="flex items-center text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className={isProxima ? 'text-blue-600 font-medium' : ''}>
                      {isProxima ? '📍 ' : ''}{distanceText || 'Distância indisponível'}
                    </span>
                  </div>
                  
                  <span className="mx-2 text-gray-300">|</span>
                  
                  <div className="text-gray-500 text-sm">
                    <span className="font-medium">ID:</span> {os.id.substring(0, 8)}...
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2 ml-2">
                {!isAtendida && (
                  <>
                    <button
                      onClick={() => onSelectOS(os)}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors flex items-center shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Navegar
                    </button>
                    <button
                      onClick={() => onConcluirOS(os.id)}
                      className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors flex items-center shadow-sm"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Concluir
                    </button>
                  </>
                )}
                {isAtendida && (
                  <span className="px-3 py-1.5 bg-green-100 text-green-800 text-sm rounded-md flex items-center shadow-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
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