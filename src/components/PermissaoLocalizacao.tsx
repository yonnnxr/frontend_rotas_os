import React, { useEffect, useState } from 'react';

interface PermissaoLocalizacaoProps {
  onPermitir: () => void;
  onNegar: () => void;
}

// Definindo os keyframes como uma string de CSS
const pulseKeyframes = `
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
    50% { transform: scale(1.05); opacity: 0.9; box-shadow: 0 0 0 10px rgba(59, 130, 246, 0); }
    100% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
  }
`;

const PermissaoLocalizacao: React.FC<PermissaoLocalizacaoProps> = ({ onPermitir, onNegar }) => {
  // Estado para controlar a pulsação do botão de permissão
  const [pulsar, setPulsar] = useState(false);
  // Estado para animação de entrada
  const [animacaoEntrada, setAnimacaoEntrada] = useState(false);
  // Estado para controlar a visibilidade do componente (para debugging)
  const [componenteVisivel, setComponenteVisivel] = useState(true);
  
  // Efeito para criar uma pulsação no botão principal a cada 1.5 segundos
  useEffect(() => {
    console.log('[PermissaoLocalizacao] Componente montado');
    
    // Adiciona os estilos CSS diretamente ao cabeçalho do documento
    const styleElement = document.createElement('style');
    styleElement.innerHTML = pulseKeyframes;
    document.head.appendChild(styleElement);
    
    const interval = setInterval(() => {
      setPulsar(prev => !prev);
    }, 1500);
    
    // Ativar animação de entrada após um breve delay
    setTimeout(() => {
      setAnimacaoEntrada(true);
      console.log('[PermissaoLocalizacao] Animação de entrada ativada');
    }, 100);
    
    // Verificar periodicamente se o componente ainda está visível
    const checkVisibilityInterval = setInterval(() => {
      const element = document.querySelector('.permissao-localizacao-container');
      if (!element) {
        console.warn('[PermissaoLocalizacao] Container não encontrado no DOM');
      } else {
        const style = window.getComputedStyle(element);
        console.log('[PermissaoLocalizacao] Visibilidade:', style.visibility, 'Display:', style.display, 'Opacity:', style.opacity);
      }
    }, 5000);
    
    return () => {
      clearInterval(interval);
      clearInterval(checkVisibilityInterval);
      // Remove o elemento de estilo quando o componente é desmontado
      if (styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
      console.log('[PermissaoLocalizacao] Componente desmontado');
    };
  }, []);
  
  // Funções para lidar com os cliques nos botões
  const handlePermitir = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[PermissaoLocalizacao] Botão permitir clicado');
    setComponenteVisivel(false);
    onPermitir();
  };
  
  const handleNegar = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[PermissaoLocalizacao] Botão negar clicado');
    setComponenteVisivel(false);
    onNegar();
  };
  
  // Evita que cliques fora do modal fechem o popup
  const prevenirPropagacao = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };
  
  // Se o componente não deve ser visível, não renderizar nada
  if (!componenteVisivel) {
    return null;
  }
  
  return (
    <div 
      className="permissao-localizacao-container fixed inset-0 flex items-center justify-center z-[9999]"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)'
      }}
      onClick={prevenirPropagacao}
    >
      <div 
        className={`
          bg-white rounded-xl p-6 mx-4 shadow-2xl
          transform transition-all duration-500 ease-out
          ${animacaoEntrada ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}
        `}
        style={{ 
          position: 'relative',
          zIndex: 10000,
          maxWidth: '90vw',
          width: '450px',
          backgroundColor: 'white'
        }}
      >
        {/* Ícone destacado no topo */}
        <div className="flex justify-center -mt-16 mb-4">
          <div 
            className={`
              w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg
              flex items-center justify-center
              ${pulsar ? 'animate-pulse' : ''}
            `}
            style={{
              boxShadow: '0 8px 16px -4px rgba(59, 130, 246, 0.5)'
            }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
        </div>
        
        <h3 className="text-2xl font-bold text-center text-gray-800 mb-4">
          Permissão de Localização
        </h3>
        
        <div className="mb-6 bg-blue-50 rounded-lg p-4 border-l-4 border-blue-500">
          <div className="flex items-start">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2 text-blue-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-blue-800 leading-tight">
              Para encontrar as ordens de serviço mais próximas, precisamos da sua localização atual.
            </p>
          </div>
        </div>
        
        <p className="mb-5 text-gray-600 text-base">
          Isso permitirá:
        </p>
        
        <ul className="mb-6 space-y-3">
          <li className="flex items-start">
            <div className="bg-green-100 rounded-full p-1 mr-3 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-gray-700">Localizar a ordem de serviço mais próxima de você</span>
          </li>
          <li className="flex items-start">
            <div className="bg-green-100 rounded-full p-1 mr-3 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-gray-700">Traçar rotas otimizadas para as ordens de serviço</span>
          </li>
          <li className="flex items-start">
            <div className="bg-green-100 rounded-full p-1 mr-3 flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-gray-700">Calcular distâncias e tempos estimados</span>
          </li>
        </ul>
        
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 sm:justify-end mt-8">
          <button 
            onClick={handleNegar}
            className="px-5 py-3 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            Continuar sem localização
          </button>
          <button 
            onClick={handlePermitir}
            className={`
              px-5 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800
              transition-all duration-300 font-bold shadow-md hover:shadow-lg
              ${pulsar ? 'animate-pulse shadow-blue-500/50' : 'shadow-blue-500/30'}
            `}
            style={{
              animation: pulsar ? 'pulse 2s infinite' : 'none'
            }}
          >
            Permitir Acesso
          </button>
        </div>
        
        <div className="mt-6 pt-4 border-t border-gray-200 text-xs text-gray-500 text-center">
          Seus dados de localização são utilizados apenas enquanto o aplicativo está em uso
          e não são armazenados permanentemente.
        </div>
      </div>
    </div>
  );
};

export default PermissaoLocalizacao; 