import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Função para verificar se o usuário já concedeu permissão de localização
function checkLocationPermission() {
  // Se estamos em um ambiente de desenvolvimento ou não suporta geolocalização, prossegue normalmente
  if (import.meta.env.DEV || !navigator.geolocation) {
    return renderApp();
  }

  // Verifica se o usuário já concedeu permissão anteriormente (armazenado no localStorage)
  const permissionGranted = localStorage.getItem('locationPermissionGranted');
  
  // Se a permissão foi concedida, renderiza o app normalmente
  if (permissionGranted === 'true') {
    return renderApp();
  }
  
  // Se estamos em uma página de permissão específica, não redirecionamos para evitar loop
  if (window.location.pathname === '/location-permission.html') {
    return renderApp();
  }
  
  // Caso contrário, redirecionamos para a página de permissão
  window.location.href = '/location-permission.html';
}

// Função para renderizar o aplicativo
function renderApp() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

// Inicia o processo de verificação de permissão
checkLocationPermission(); 