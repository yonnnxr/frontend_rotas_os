import React, { useEffect, useState } from 'react';

interface PermissaoLocalizacaoProps {
  onPermitir: () => void;
  onNegar: () => void;
}

// Definindo os keyframes como uma string de CSS
const pulseKeyframes = `
  @keyframes pulse {
    0% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.1); opacity: 0.9; }
    100% { transform: scale(1); opacity: 1; }
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
      className="permissao-localizacao-container fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999]"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)'
      }}
      onClick={prevenirPropagacao}
    >
      <div 
        className={`
          bg-white rounded-lg p-6 max-w-md mx-4 shadow-2xl border-4 border-blue-500
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
        <div 
          className="absolute -top-4 -right-4 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold"
          style={{ animation: 'pulse 2s infinite' }}
        >
          !
        </div>
        
        <div className="flex items-center mb-4">
          <div className={`
            bg-blue-100 p-3 rounded-full mr-3 transition-all
            ${pulsar ? 'bg-blue-200 shadow-lg' : 'bg-blue-100'}
          `}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-blue-800">Permissão de Localização</h3>
        </div>
        
        <div className="mb-6 border-l-4 border-blue-500 pl-3 py-2 bg-blue-50">
          <p className="text-blue-800 font-medium">
            Este sistema precisa da sua localização para funcionar corretamente
          </p>
        </div>
        
        <p className="mb-4 text-gray-600">
          Para encontrar as ordens de serviço mais próximas de você, o sistema precisa acessar sua localização atual.
          Isso tornará o seu trabalho muito mais eficiente.
        </p>
        
        <p className="mb-6 text-gray-600">
          <strong className="text-red-600">Importante:</strong> Você pode usar o sistema sem compartilhar sua localização, 
          mas as funcionalidades serão limitadas.
        </p>
        
        <div className="flex flex-col space-y-3 sm:flex-row sm:space-y-0 sm:space-x-3 sm:justify-end">
          <button 
            onClick={handleNegar}
            className="px-4 py-3 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition-colors"
          >
            Continuar sem localização
          </button>
          <button 
            onClick={handlePermitir}
            className={`
              px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
              transition-all duration-300 font-bold
              ${pulsar ? 'transform scale-105 shadow-lg bg-blue-500' : ''}
            `}
          >
            Permitir Acesso à Localização
          </button>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-500 text-center">
          Esta permissão é necessária apenas enquanto você utiliza o aplicativo.
          Seus dados de localização não são armazenados.
        </div>
      </div>
    </div>
  );
};

export default PermissaoLocalizacao; 