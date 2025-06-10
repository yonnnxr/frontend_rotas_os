#!/usr/bin/env node

/**
 * Script para automatizar a geração de APK a partir do PWA
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Obter o diretório atual do módulo ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cores para o console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

// Configurações do app
const config = {
  appName: 'Otimizador de Rotas OS',
  appShortName: 'Rotas OS',
  packageName: 'com.otimizador.rotas',
  versionName: '1.0.0',
  versionCode: 1,
  backgroundColor: '#ffffff',
  themeColor: '#4a90e2',
  webManifestUrl: '',
  iconUrl: '',
  maskableIconUrl: '',
  splashScreenUrl: ''
};

// Diretório para criar o projeto TWA
const twaDir = path.join(__dirname, 'twa-build');

// Função para executar comandos com output no console
function runCommand(command, cwd = process.cwd()) {
  console.log(`${colors.blue}Executando:${colors.reset} ${command}`);
  try {
    return execSync(command, { cwd, stdio: 'inherit' });
  } catch (error) {
    console.error(`${colors.red}Erro ao executar comando:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Verifica se o PWA está hospedado
function checkPwaUrl() {
  const pwaUrl = process.argv[2];
  if (!pwaUrl) {
    console.error(`${colors.red}Erro: URL do PWA não fornecida${colors.reset}`);
    console.log(`${colors.yellow}Uso: node gerar_apk.js https://seu-pwa.com${colors.reset}`);
    process.exit(1);
  }
  
  // Remover qualquer barra final da URL
  const cleanUrl = pwaUrl.replace(/\/$/, '');
  
  // Verificar se a URL começa com http:// ou https://
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    console.error(`${colors.red}Erro: URL deve começar com http:// ou https://${colors.reset}`);
    process.exit(1);
  }
  
  // Verificar se estamos usando HTTPS para produção
  if (cleanUrl.startsWith('http://') && !cleanUrl.includes('localhost')) {
    console.warn(`${colors.yellow}Aviso: URLs que não usam HTTPS podem causar problemas no APK final.${colors.reset}`);
  }
  
  // Configurar URLs dos recursos
  config.webManifestUrl = `${cleanUrl}/manifest.json`;
  config.iconUrl = `${cleanUrl}/icons/icon.png`;
  config.maskableIconUrl = `${cleanUrl}/icons/adaptive-icon.png`;
  config.splashScreenUrl = `${cleanUrl}/icons/splash.png`;
  
  console.log(`${colors.blue}URLs configuradas:${colors.reset}`);
  console.log(`- Manifest: ${config.webManifestUrl}`);
  console.log(`- Ícone Principal: ${config.iconUrl}`);
  console.log(`- Ícone Adaptável: ${config.maskableIconUrl}`);
  console.log(`- Splash Screen: ${config.splashScreenUrl}`);
  
  return cleanUrl;
}

// Cria diretório do TWA se não existir
function createTwaDir() {
  if (!fs.existsSync(twaDir)) {
    console.log(`${colors.green}Criando diretório TWA:${colors.reset} ${twaDir}`);
    fs.mkdirSync(twaDir, { recursive: true });
  } else {
    console.log(`${colors.yellow}Diretório TWA já existe:${colors.reset} ${twaDir}`);
  }
}

// Inicia o processo de geração do APK
async function main() {
  console.log(`${colors.green}=== Iniciando geração de APK para PWA ===${colors.reset}`);
  
  // Verificar URL do PWA
  const pwaUrl = checkPwaUrl();
  console.log(`${colors.green}URL do PWA:${colors.reset} ${pwaUrl}`);
  
  // Verificar se o Bubblewrap está instalado
  try {
    execSync('bubblewrap --version', { stdio: 'pipe' });
  } catch (error) {
    console.log(`${colors.yellow}Bubblewrap não encontrado. Instalando...${colors.reset}`);
    runCommand('npm install -g @bubblewrap/cli');
  }
  
  // Criar diretório e iniciar projeto
  createTwaDir();
  
  // Inicializar o projeto TWA
  console.log(`${colors.green}Inicializando projeto TWA${colors.reset}`);
  process.chdir(twaDir);
  
  // Verificar se estamos usando localhost (para desenvolvimento)
  const isLocalhost = pwaUrl.includes('localhost') || pwaUrl.includes('127.0.0.1');
  
  // Preparar URLs alternativas para ícones locais em caso de localhost
  let localIconUrl = config.iconUrl;
  let localMaskableIconUrl = config.maskableIconUrl;
  let localSplashScreenUrl = config.splashScreenUrl;
  
  if (isLocalhost) {
    console.log(`${colors.yellow}Modo localhost detectado. Configurando ícones locais...${colors.reset}`);
    
         // Caminhos para os ícones locais (adaptados para rodar de dentro da pasta frontend_rotas_os)
     const localPublicDir = path.join(__dirname, 'public');
     const iconPath = path.join(localPublicDir, 'icons', 'icon.png');
     const adaptiveIconPath = path.join(localPublicDir, 'icons', 'adaptive-icon.png');
     const splashPath = path.join(localPublicDir, 'icons', 'splash.png');
    
    // Verificar se os ícones existem localmente
    if (fs.existsSync(iconPath)) {
      // Copiar para a pasta do projeto TWA
      const twaIconPath = path.join(twaDir, 'icon.png');
      fs.copyFileSync(iconPath, twaIconPath);
      localIconUrl = `file://${twaIconPath}`;
      console.log(`${colors.green}Ícone principal copiado para o projeto TWA${colors.reset}`);
    }
    
    if (fs.existsSync(adaptiveIconPath)) {
      const twaAdaptiveIconPath = path.join(twaDir, 'adaptive-icon.png');
      fs.copyFileSync(adaptiveIconPath, twaAdaptiveIconPath);
      localMaskableIconUrl = `file://${twaAdaptiveIconPath}`;
      console.log(`${colors.green}Ícone adaptativo copiado para o projeto TWA${colors.reset}`);
    }
    
    if (fs.existsSync(splashPath)) {
      const twaSplashPath = path.join(twaDir, 'splash.png');
      fs.copyFileSync(splashPath, twaSplashPath);
      localSplashScreenUrl = `file://${twaSplashPath}`;
      console.log(`${colors.green}Splash screen copiado para o projeto TWA${colors.reset}`);
    }
  }
  
  // Criar arquivo de configuração TWA
  const twaManifest = {
    "packageId": config.packageName,
    "host": pwaUrl.replace(/https?:\/\//, ''),
    "name": config.appName,
    "launcherName": config.appShortName,
    "display": "standalone",
    "themeColor": config.themeColor,
    "navigationColor": config.themeColor,
    "navigationColorDark": config.themeColor,
    "backgroundColor": config.backgroundColor,
    "enableNotifications": true,
    "shortcuts": [],
    "webManifestUrl": config.webManifestUrl,
    "iconUrl": isLocalhost ? localIconUrl : config.iconUrl,
    "maskableIconUrl": isLocalhost ? localMaskableIconUrl : config.maskableIconUrl,
    "splashScreenUrl": isLocalhost ? localSplashScreenUrl : config.splashScreenUrl,
    "fallbackType": "customtabs",
    "features": {
      "locationDelegation": {
        "enabled": true
      },
      "playBilling": {
        "enabled": false
      }
    },
    "alphaDependencies": {
      "enabled": false
    },
    "enableSiteSettingsShortcut": true,
    "isChromeOSOnly": false,
    "isMetaQuest": false,
    "fullScopeUrl": pwaUrl,
    "minSdkVersion": 19,
    "orientation": "default",
    "fingerprints": [],
    "additionalTrustedOrigins": [],
    "retainedBundles": [],
    "appVersionName": config.versionName,
    "appVersionCode": config.versionCode
  };
  
  fs.writeFileSync('twa-manifest.json', JSON.stringify(twaManifest, null, 2));
  console.log(`${colors.green}Arquivo twa-manifest.json criado${colors.reset}`);
  
  // Gerar APK
  console.log(`${colors.green}Gerando APK...${colors.reset}`);
  
  // Primeiro, tentamos inicializar o projeto com o bubblewrap
  try {
    console.log(`${colors.blue}Inicializando projeto Bubblewrap...${colors.reset}`);
    runCommand(`bubblewrap init --manifest="${config.webManifestUrl}" --directory="${twaDir}"`);
  } catch (error) {
    console.log(`${colors.yellow}Não foi possível inicializar com manifest, tentando build direto...${colors.reset}`);
  }
  
  // Em seguida, construímos o APK
  try {
    runCommand('bubblewrap build --skipPwaValidation');
  } catch (error) {
    console.error(`${colors.red}Falha ao gerar APK. Tentando uma abordagem alternativa...${colors.reset}`);
    
    // Criar arquivo de ícones temporário se necessário
    const iconPath = path.join(twaDir, 'icon.png');
    if (!fs.existsSync(iconPath)) {
      console.log(`${colors.yellow}Criando arquivo de ícone temporário...${colors.reset}`);
      // Download do ícone ou cópia local
      try {
        // Tenta usar um ícone da pasta public se existir
        const publicIconPath = path.join(__dirname, 'frontend_rotas_os', 'public', 'icons', 'icon.png');
        if (fs.existsSync(publicIconPath)) {
          fs.copyFileSync(publicIconPath, iconPath);
          console.log(`${colors.green}Ícone copiado de: ${publicIconPath}${colors.reset}`);
        } else {
          console.log(`${colors.red}Ícone não encontrado localmente. Por favor, crie manualmente um arquivo icon.png na pasta ${twaDir}${colors.reset}`);
        }
      } catch (iconError) {
        console.error(`${colors.red}Erro ao preparar ícone: ${iconError.message}${colors.reset}`);
      }
    }
    
    // Tenta novamente com o comando mais simples
    console.log(`${colors.blue}Tentando construir novamente com opções simplificadas...${colors.reset}`);
    runCommand('bubblewrap build --skipPwaValidation');
  }
  
  // Verificar se o APK foi gerado
  const apkPath = path.join(twaDir, 'app-release-signed.apk');
  if (fs.existsSync(apkPath)) {
    console.log(`${colors.green}APK gerado com sucesso:${colors.reset} ${apkPath}`);
    
    // Copiar APK para a raiz do projeto
    const destPath = path.join(__dirname, 'rotasOS.apk');
    fs.copyFileSync(apkPath, destPath);
    console.log(`${colors.green}APK copiado para:${colors.reset} ${destPath}`);
  } else {
    console.error(`${colors.red}Erro: APK não foi gerado${colors.reset}`);
  }
  
  console.log(`${colors.green}=== Processo de geração de APK concluído ===${colors.reset}`);
}

// Executar o script
main().catch(error => {
  console.error(`${colors.red}Erro:${colors.reset}`, error);
  process.exit(1);
}); 