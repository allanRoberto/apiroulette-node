# API de Integração com LotoGreen

Esta API serve como uma camada intermediária (middleware) entre aplicativos cliente e a plataforma de apostas LotoGreen. Ela facilita operações como autenticação, registro de usuários, depósitos e início de jogos.

## Funcionalidades

- **Autenticação**: Login e registro de usuários
- **Gerenciamento de Usuários**: Busca de dados do usuário autenticado
- **Depósitos**: Processamento de depósitos na plataforma
- **Jogos**: Inicialização de jogos da plataforma
- **Armazenamento de Dados**: Persistência de dados de usuários no MongoDB

## Tecnologias Utilizadas

- Node.js
- Express
- MongoDB (Mongoose)
- Axios para requisições HTTP
- Express-session para gerenciamento de sessões

## Configuração

1. Clone o repositório
2. Instale as dependências com `npm install`
3. Configure a conexão do MongoDB no arquivo `index.js`
4. Inicie o servidor com `npm start`

## Endpoints Disponíveis

- **POST /api/auth/login**: Autenticação de usuários
- **GET /api/auth/user**: Busca dados do usuário autenticado
- **POST /api/register**: Registro de novos usuários
- **POST /api/deposit**: Processamento de depósitos
- **GET /api/start-game/:gameId**: Inicialização de jogos

## Banco de Dados

O servidor utiliza MongoDB para armazenar informações dos usuários. O schema inclui:
- name: Nome do usuário
- email: Email do usuário
- phone: Telefone do usuário
- status: Status na plataforma
- platformId: ID do usuário na plataforma original
- documentNumber: Número de documento do usuário
- appInstall: Status de instalação do aplicativo

## Ambiente de Desenvolvimento

O servidor está configurado para rodar na porta 3090 por padrão. Para desenvolvimento, as configurações de CORS permitem requisições de qualquer origem. Em ambiente de produção, recomenda-se configurar adequadamente as restrições de CORS e utilizar HTTPS para conexões seguras. 