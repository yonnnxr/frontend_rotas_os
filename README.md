# Otimizador de Rotas - Frontend

Frontend do sistema de otimização de rotas para ordens de serviço.

## Tecnologias

- [Vite](https://vitejs.dev/) - Build tool e dev server
- [React](https://react.dev/) - Biblioteca UI
- [TypeScript](https://www.typescriptlang.org/) - Tipagem estática
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS
- [React Router](https://reactrouter.com/) - Roteamento
- [Supabase](https://supabase.com/) - Backend as a Service
- [Headless UI](https://headlessui.com/) - Componentes acessíveis
- [Heroicons](https://heroicons.com/) - Ícones

## Requisitos

- Node.js 18+
- npm ou yarn

## Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/otimizador-rotas.git
cd otimizador-rotas/frontend_rotas_os
```

2. Instale as dependências:
```bash
npm install
# ou
yarn
```

3. Crie um arquivo `.env` na raiz do projeto e configure as variáveis de ambiente:
```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

## Desenvolvimento

Para iniciar o servidor de desenvolvimento:

```bash
npm run dev
# ou
yarn dev
```

O servidor iniciará em `http://localhost:3000`.

## Build

Para gerar a build de produção:

```bash
npm run build
# ou
yarn build
```

## Autenticação

O sistema utiliza um sistema de autenticação simplificado baseado em código de equipe. Cada equipe possui um código único que é usado para acessar o sistema.

### Estrutura da Tabela de Equipes

A tabela `teams` no Supabase deve ter a seguinte estrutura:

```sql
create table teams (
  id uuid default uuid_generate_v4() primary key,
  code text not null unique,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### Fluxo de Autenticação

1. O usuário acessa a página de login
2. Insere o código da equipe
3. O sistema valida o código contra a tabela `teams`
4. Se válido, armazena os dados da equipe no localStorage e redireciona para o dashboard
5. Se inválido, exibe mensagem de erro

## Estrutura do Projeto

```
frontend_rotas_os/
├── src/
│   ├── components/     # Componentes reutilizáveis
│   ├── contexts/      # Contextos React (AuthContext)
│   ├── layouts/        # Layouts da aplicação
│   ├── pages/         # Páginas da aplicação
│   ├── services/      # Serviços e integrações
│   ├── styles/        # Estilos globais
│   ├── types/         # Tipos TypeScript
│   ├── utils/         # Funções utilitárias
│   ├── App.tsx        # Componente principal
│   └── main.tsx       # Ponto de entrada
├── public/            # Arquivos estáticos
├── .env              # Variáveis de ambiente
├── .eslintrc.cjs     # Configuração do ESLint
├── .gitignore        # Arquivos ignorados pelo Git
├── index.html        # HTML principal
├── package.json      # Dependências e scripts
├── postcss.config.js # Configuração do PostCSS
├── tailwind.config.js # Configuração do Tailwind
├── tsconfig.json     # Configuração do TypeScript
└── vite.config.ts    # Configuração do Vite
```

## Scripts

- `dev`: Inicia o servidor de desenvolvimento
- `build`: Gera a build de produção
- `preview`: Visualiza a build de produção localmente
- `lint`: Executa o linter no código

## Contribuição

1. Faça o fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Faça commit das suas alterações (`git commit -m 'feat: Adiciona nova feature'`)
4. Faça push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes. 