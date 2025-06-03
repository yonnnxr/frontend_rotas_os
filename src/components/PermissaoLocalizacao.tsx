import React from 'react';

interface PermissaoLocalizacaoProps {
  onPermitir: () => void;
  onNegar: () => void;
}

const PermissaoLocalizacao: React.FC<PermissaoLocalizacaoProps> = ({ onPermitir, onNegar }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
      <div className="bg-white rounded-lg p-6 max-w-md mx-4 shadow-xl">
        <h3 className="text-lg font-medium mb-3">Permissão de Localização</h3>
        <p className="mb-4 text-gray-600">
          Para funcionar corretamente, o sistema precisa acessar sua localização atual.
          Isso permitirá encontrar a ordem de serviço mais próxima de você.
        </p>
        <p className="mb-4 text-gray-600">
          <strong>Importante:</strong> Você pode usar o sistema mesmo sem compartilhar sua localização, 
          mas algumas funcionalidades serão limitadas.
        </p>
        <div className="flex justify-end space-x-3">
          <button 
            onClick={onNegar}
            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
          >
            Continuar sem localização
          </button>
          <button 
            onClick={onPermitir}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Permitir Acesso
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissaoLocalizacao; 