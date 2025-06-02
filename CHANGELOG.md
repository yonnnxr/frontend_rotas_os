# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.3.0] - 2024-03-14

### Adicionado
- Integração com backend Quart
- Configuração de variáveis de ambiente para API
- Tipos TypeScript para variáveis de ambiente
- Atualização do serviço de autenticação para usar o backend

### Modificado
- Serviço Supabase para usar o backend como intermediário
- Estrutura do projeto para melhor organização

## [0.2.0] - 2024-03-14

### Adicionado
- Sistema de autenticação simplificado com código de equipe
- Contexto de autenticação com React Context API
- Proteção de rotas para usuários não autenticados
- Exibição de informações da equipe no dashboard
- Funcionalidade de logout

### Modificado
- Simplificação da página de login para usar apenas código de equipe
- Remoção da página de registro
- Atualização do layout do dashboard para incluir informações da equipe

## [0.1.0] - 2024-03-14

### Adicionado
- Setup inicial do projeto com Vite + React + TypeScript
- Configuração do Tailwind CSS para estilização
- Configuração do ESLint e Prettier para padronização do código
- Layout base da aplicação com suporte a responsividade
- Sistema de roteamento com React Router
- Lazy loading de componentes para melhor performance
- Páginas iniciais:
  - Login
  - Registro
  - Dashboard
  - 404 (Not Found)
- Layouts:
  - AuthLayout para páginas de autenticação
  - DashboardLayout com sidebar responsiva 