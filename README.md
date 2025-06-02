# Frontend - Sistema de Rotas OS

## Visão Geral
Interface web do sistema de Rotas OS, desenvolvida para proporcionar uma experiência de usuário intuitiva e responsiva.

## Tecnologias Utilizadas
- React 18+
- TypeScript 5.x
- Vite 5.x
- Tailwind CSS 3.x
- React Query 5.x
- React Router DOM 6.x
- Vitest (Testes)
- ESLint + Prettier
- Axios (HTTP Client)
- React Hook Form
- Zod (Validação)
- Leaflet (Mapas)
- DayJS (Datas)
- i18next (Internacionalização)

## Requisitos do Sistema
- Node.js 18+
- NPM 8+

## Configuração do Ambiente

### Instalação
```bash
cd frontend_rotas_os
npm install
```

### Variáveis de Ambiente
Crie um arquivo `.env` com as seguintes variáveis:
```
# API
VITE_API_URL=http://localhost:3000
VITE_APP_ENV=development

# Mapas
VITE_MAPBOX_TOKEN=seu_token_mapbox

# Recursos
VITE_ENABLE_PWA=true
VITE_ENABLE_ANALYTICS=false

# i18n
VITE_DEFAULT_LANGUAGE=pt-BR
```

## Scripts Disponíveis
- `npm run dev`: Inicia o servidor de desenvolvimento
- `npm run build`: Compila o projeto para produção
- `npm run preview`: Visualiza a build de produção localmente
- `npm test`: Executa os testes unitários
- `npm run test:e2e`: Executa os testes E2E com Cypress
- `npm run lint`: Executa o ESLint
- `npm run format`: Formata o código com Prettier
- `npm run storybook`: Inicia o Storybook para desenvolvimento de componentes
- `npm run build-storybook`: Compila a documentação do Storybook
- `npm run analyze`: Analisa o tamanho do bundle

## Estrutura do Projeto
```
frontend_rotas_os/
├── src/
│   ├── assets/         # Arquivos estáticos
│   ├── components/     # Componentes React
│   │   ├── common/    # Componentes compartilhados
│   │   ├── forms/     # Componentes de formulário
│   │   ├── layout/    # Componentes de layout
│   │   └── maps/      # Componentes de mapas
│   ├── pages/         # Páginas da aplicação
│   ├── hooks/         # Hooks personalizados
│   ├── services/      # Serviços e API
│   ├── store/         # Gerenciamento de estado
│   ├── utils/         # Utilitários
│   ├── styles/        # Estilos e temas
│   ├── types/         # Tipos TypeScript
│   ├── i18n/          # Traduções
│   ├── routes/        # Configuração de rotas
│   └── App.tsx        # Componente principal
├── public/            # Arquivos estáticos
├── tests/            # Testes
│   ├── unit/        # Testes unitários
│   ├── integration/ # Testes de integração
│   └── e2e/        # Testes end-to-end
├── .storybook/      # Configuração do Storybook
├── cypress/         # Testes E2E com Cypress
├── .env.example     # Exemplo de variáveis de ambiente
├── .eslintrc.js    # Configuração do ESLint
├── .prettierrc     # Configuração do Prettier
├── tailwind.config.js # Configuração do Tailwind
├── tsconfig.json   # Configuração do TypeScript
├── vite.config.ts  # Configuração do Vite
├── README.md       # Esta documentação
├── tarefas.md      # Lista de tarefas
└── CHANGELOG.md    # Histórico de mudanças

## Padrões de Código
- Utilizar TypeScript para todo o código
- Componentes funcionais com hooks
- Styled Components para estilos específicos
- Tailwind para estilos utilitários
- Testes para componentes principais
- Documentação com Storybook
- Lazy loading para rotas
- Memoização quando necessário

## Convenções
- Nomes de componentes em PascalCase
- Nomes de hooks em camelCase começando com 'use'
- Nomes de utilitários em camelCase
- Testes com extensão .test.tsx ou .spec.tsx
- Stories com extensão .stories.tsx

## Documentação Adicional
- [Guia de Estilo](/docs/style-guide.md)
- [Guia de Contribuição](/docs/contributing.md)
- [Documentação dos Componentes](https://storybook.rotas-os.com)
- [Arquitetura](/docs/architecture.md) 