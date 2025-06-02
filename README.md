# Otimizador de Rotas

Interface web do sistema de otimização de rotas para ordens de serviço, construída com React e TypeScript.

## 🚀 Tecnologias

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Mapbox GL JS
- React Router DOM

## 📋 Pré-requisitos

- Node.js 18 ou superior
- npm ou yarn
- Acesso à API do backend

## 🔧 Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/otimizador-rotas.git
cd otimizador-rotas
```

2. Instale as dependências:
```bash
npm install
# ou
yarn
```

3. Configure as variáveis de ambiente:
```bash
# Copie o arquivo de exemplo
cp .env.example .env

# Edite o arquivo .env com suas configurações
```

## 🚀 Executando o projeto

### Desenvolvimento

```bash
npm run dev
# ou
yarn dev
```

O aplicativo iniciará em `http://localhost:5173`

### Produção

```bash
npm run build
npm run preview
# ou
yarn build
yarn preview
```

## 📦 Estrutura do Projeto

```
frontend_rotas_os/
├── src/
│   ├── components/     # Componentes React
│   ├── contexts/      # Contextos React
│   ├── pages/         # Páginas da aplicação
│   ├── services/      # Serviços e API
│   ├── types/         # Tipos TypeScript
│   ├── utils/         # Utilitários
│   ├── App.tsx        # Componente principal
│   └── main.tsx       # Ponto de entrada
├── public/           # Arquivos estáticos
├── index.html       # HTML principal
├── package.json    # Dependências e scripts
├── tsconfig.json  # Configuração TypeScript
├── vite.config.ts # Configuração Vite
└── tailwind.config.js # Configuração Tailwind
```

## 🔧 Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| VITE_API_URL | URL da API backend | http://localhost:5000 |
| VITE_BASE_PATH | Base path para GitHub Pages | / |

## 🌟 Funcionalidades

- Autenticação por código de equipe
- Visualização de ordens de serviço no mapa
- Interface responsiva e moderna
- Integração com Mapbox GL JS para mapas
- Suporte a temas claro/escuro

## 🤝 Contribuindo

1. Faça o fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -m 'feat: Adicionando nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes. 