// Script para configurar o TWA manualmente
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

// Obter o diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações do app
const config = {
  appName: 'Otimizador de Rotas OS',
  appShortName: 'Rotas OS',
  packageName: 'com.otimizador.rotas',
  versionName: '1.0.0',
  versionCode: 1,
  backgroundColor: '#ffffff',
  themeColor: '#4a90e2',
  url: process.argv[2] || 'https://geodadosbr.com.br/'
};

// Verificar a URL
if (!config.url.startsWith('http')) {
  console.error('Erro: URL deve começar com http:// ou https://');
  process.exit(1);
}

// Remover barra final
config.url = config.url.replace(/\/$/, '');

// Extrair hostname
const hostname = new URL(config.url).hostname;
console.log(`URL: ${config.url}`);
console.log(`Hostname: ${hostname}`);

// Diretório para criar o projeto TWA
const twaDir = path.join(__dirname, 'twa-build');
if (!fs.existsSync(twaDir)) {
  fs.mkdirSync(twaDir, { recursive: true });
} else {
  // Limpar o diretório
  const files = fs.readdirSync(twaDir);
  for (const file of files) {
    if (file !== 'gradle.properties') {
      const filePath = path.join(twaDir, file);
      try {
        if (fs.lstatSync(filePath).isDirectory()) {
          // Não remover diretórios para manter o gradle
        } else {
          fs.unlinkSync(filePath);
        }
      } catch (e) {
        console.log(`Erro ao remover ${filePath}: ${e.message}`);
      }
    }
  }
}

// Criar arquivo gradle.properties com memória reduzida
const gradleProps = `# Configuracoes de memoria do Gradle
org.gradle.jvmargs=-Xmx512m -XX:MaxMetaspaceSize=256m -XX:+HeapDumpOnOutOfMemoryError
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.configureondemand=true
org.gradle.caching=true
android.useAndroidX=true
`;

fs.writeFileSync(path.join(twaDir, 'gradle.properties'), gradleProps);

// Executar o bubblewrap
console.log('Inicializando projeto TWA...');
try {
  execSync(`bubblewrap init --directory="${twaDir}" --hostname="${hostname}" --app-name="${config.appName}" --app-short-name="${config.appShortName}"`, { 
    stdio: 'inherit' 
  });
  
  console.log('Gerando APK...');
  execSync(`cd "${twaDir}" && bubblewrap build --skipPwaValidation --gradle-args="-Xmx512m"`, { 
    stdio: 'inherit' 
  });
  
  // Verificar se o APK foi gerado
  const apkPath = path.join(twaDir, 'app-release-signed.apk');
  if (fs.existsSync(apkPath)) {
    console.log(`APK gerado com sucesso: ${apkPath}`);
    // Copiar para a raiz
    fs.copyFileSync(apkPath, path.join(__dirname, 'rotasOS.apk'));
    console.log(`APK copiado para: ${path.join(__dirname, 'rotasOS.apk')}`);
  } else {
    console.error('Erro: APK não foi gerado');
  }
} catch (error) {
  console.error(`Erro ao executar bubblewrap: ${error.message}`);
}

console.log('=== Processo de geração de APK concluído ==='); 