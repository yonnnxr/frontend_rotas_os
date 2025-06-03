# Changelog

Todas as alterações notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.6.0] - 2024-06-25

### Adicionado
- Popups aprimorados com informações detalhadas da ordem de serviço
- Exibição de informações de grupo de serviço nos popups
- Exibição da descrição do serviço solicitado nos popups

### Corrigido
- Problema de coordenadas incorretas que exibiam ordens em Belo Horizonte em vez de Anastácio/MS
- Ajuste de longitude com deslocamento de 12 graus para posicionamento correto
- Melhor tratamento de erros ao carregar ordens de serviço

### Modificado
- Melhorias na interface de usuário para visualização mais clara das ordens
- Otimização do código de carregamento de ordens de serviço
- Refinamento da lógica de ajuste de visualização do mapa

## [0.5.0] - 2024-06-10

### Adicionado
- Configuração de GitHub Actions para deploy automático
- Integração com o backend para carregamento de ordens
- Visualização das ordens específicas da equipe logada
- Diferenciação visual por status da ordem (cores diferentes)

### Modificado
- Fluxo de autenticação para usar token JWT do backend
- Interface do mapa para melhor experiência do usuário

## [0.4.0] - 2024-05-25

### Adicionado
- Implementação do mapa com Leaflet
- Marcadores para ordens de serviço
- Popups básicos com informações das ordens
- Ajuste automático do zoom para visualizar todas as ordens

### Modificado
- Layout da aplicação para dar destaque ao mapa
- Transição entre telas de login e visualização principal

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