// Importação dos módulos necessários
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const cors = require('cors');
const session = require('express-session');

// Configuração do MongoDB para armazenamento de usuários
// Modelo temporário para o MongoDB
// Este bloco tenta conectar ao banco de dados e cria o modelo de usuário
const mongoose = require('mongoose');
let User;
try {
  // Tentativa de conectar ao MongoDB
  mongoose.connect('', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    authSource: 'admin'
  }).then(() => {
    console.log('Conectado ao MongoDB');
    
    // Definição do schema do usuário com campos relevantes
    const userSchema = new mongoose.Schema({
      name: String,
      email: String,
      phone: String,
      status: String,
      platformId: String,
      documentNumber: String,
      appInstall: {
        type: Boolean,
        default: false
      }
    }, { versionKey: false });
    
    // Criação do modelo User com base no schema definido
    User = mongoose.model('users_analista_da_bet_app', userSchema);
  }).catch(err => {
    console.warn('Não foi possível conectar ao MongoDB, funcionando sem persistência:', err.message);
  });
} catch (error) {
  console.warn('MongoDB não configurado, funcionando sem persistência:', error.message);
}

// Inicialização da aplicação Express
const app = express();
const port =  3090;

// Configuração de CORS para permitir requisições de diferentes origens
app.use(cors({
    origin: true,
    credentials: true
}));

// Configuração da sessão para autenticação
app.use(session({
    secret: '',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Para desenvolvimento (use true em produção com HTTPS)
}));

// Configuração do bodyParser para processar requisições com corpo JSON
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Rota de autenticação para login de usuários
app.post('/api/auth/login', async (req, res) => {
    try {
        // Extrai email e senha do corpo da requisição
        const { email, password } = req.body;

        // Configuração da requisição para a API da LotoGreen
        const config = {
            method: 'post',
            url: 'https://lotogreen.bet.br/api/auth/login',
            headers: { 
                'accept': 'application/json', 
                'accept-language': 'pt,pt-PT;q=0.9,en-US;q=0.8,en;q=0.7', 
                'authorization': 'Bearer null', 
                'cache-control': 'private, max-age=600', 
                'content-type': 'application/json', 
                'origin': 'https://lotogreen.bet.br', 
                'priority': 'u=1, i', 
                'referer': 'https://lotogreen.bet.br/', 
                'sec-ch-ua': '"Not(A:Brand";v="99", "Google Chrome";v="133", "Chromium";v="133"', 
                'sec-ch-ua-mobile': '?0', 
                'sec-ch-ua-platform': '"macOS"', 
                'sec-fetch-dest': 'empty', 
                'sec-fetch-mode': 'cors', 
                'sec-fetch-site': 'same-origin', 
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
            },
            data: {
                email: email,
                password: password,
                login: email
            }
        };

        // Envio da requisição de login para a API externa
        const response = await axios(config);
        
        // Verifica se a sessão está disponível e armazena os dados do usuário
        if (req.session) {
            // Armazena os dados do usuário na sessão
            req.session.user = response.data;
            req.session.isAuthenticated = true;
            
            // Garante que a sessão seja salva
            req.session.save((err) => {
                if (err) {
                    console.error('Erro ao salvar sessão:', err);
                }
            });
        } else {
            console.warn('Aviso: req.session não está disponível. Middleware de sessão pode não estar configurado corretamente.');
        }

        // Configuração para verificar o status do Legitimuz (verificação de identidade)
        const legitimuzConfig = {
            method: 'get',
            url: 'https://lotogreen.bet.br/api/legitimuzStatus',
            headers: { 
                'accept': '*/*',
                'authorization': `Bearer ${response.data.access_token}`,
                'content-type': 'application/json',
                'origin': 'https://lotogreen.bet.br',
                'referer': 'https://lotogreen.bet.br/'
            }
        };

        try {
            // Consulta o status do Legitimuz com o token obtido no login
            const legitimuzResponse = await axios(legitimuzConfig);
            
            // Retorna os dados de login junto com o status do Legitimuz
            res.json({
                ...response.data,
                legitimuzStatus: legitimuzResponse.data
            });
        } catch (legitimuzError) {
            console.error('Erro ao verificar status do Legitimuz:', legitimuzError.message);
            
            // Retorna apenas os dados do login se houver erro no Legitimuz
            res.json({
                ...response.data,
                legitimuzStatus: null
            });
        }
    } catch (error) {
        console.error('Erro na autenticação:', error.response?.data || error.message);
        
        // Tratamento específico de erros da API
        if (error.response?.data) {
            return res.status(error.response.status).json({
                error: error.response.data.message || error.response.data
            });
        }
        
        // Retorna erro genérico caso não seja possível determinar a causa específica
        res.status(500).json({
            error: 'Erro ao realizar login. Por favor, tente novamente.'
        });
    }
});

// Endpoint para buscar dados do usuário autenticado
app.get('/api/auth/user', async (req, res) => {
    try {
        // Extrai o token de acesso do cabeçalho de autorização
        const accessToken = req.headers.authorization?.split(' ')[1];
        
        // Verifica se o token foi fornecido
        if (!accessToken) {
            return res.status(401).json({ error: 'Token não fornecido' });
        }

        // Configuração da requisição para obter dados do usuário
        const config = {
            method: 'get',
            url: 'https://lotogreen.bet.br/api/auth/me',
            headers: { 
                'accept': 'application/json',
                'authorization': `Bearer ${accessToken}`,
                'origin': 'https://lotogreen.bet.br',
                'referer': 'https://lotogreen.bet.br/'
            }
        };

        // Envio da requisição para obter dados do usuário
        const response = await axios(config);
        const userData = response.data;

        // Verifica se o MongoDB está configurado para persistir os dados do usuário
        if (User) {
            try {
                // Verifica se o usuário já existe no banco de dados
                const existingUser = await User.findOne({ 
                    $or: [
                        { email: userData.email },
                        { platformId: userData.id }
                    ]
                });

                // Se o usuário não existir, cria um novo registro
                if (!existingUser) {
                    // Criação de um novo usuário com os dados obtidos
                    const newUser = new User({
                        name: userData.name,
                        email: userData.email,
                        phone: userData.phone,
                        status: userData.status,
                        platformId: userData.id,
                        documentNumber: userData.document?.number
                    });

                    // Salva o novo usuário no banco de dados
                    await newUser.save();
                    console.log('Novo usuário salvo no MongoDB');
                }
            } catch (dbError) {
                console.error('Erro ao interagir com o banco de dados:', dbError);
                // Continua mesmo com erro no banco, já que temos os dados do usuário da API
            }
        } else {
            console.log('MongoDB não está configurado, pulando persistência do usuário');
        }

        // Retorna os dados do usuário obtidos da API
        res.json(userData);
    } catch (error) {
        console.error('Erro ao processar usuário:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            error: error.response?.data || 'Erro ao processar usuário'
        });
    }
});

// Endpoint para processar depósitos na plataforma
app.post('/api/deposit', async (req, res) => {
    try {
        // Obtém token do cabeçalho de autorização
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, message: 'Token de autorização não fornecido' });
        }
        
        // Extrai o token e o valor do depósito
        const token = authHeader.split(' ')[1];
        const { amount } = req.body;
        
        // Converte o valor para centavos (multiplica por 100)
        const amountInCents = Math.round(parseFloat(amount) * 100);
        
        // Parâmetros fixos para a requisição de depósito
        const params = {
            ref: "453586",
            btag: "dzwyequcmmuvtaikkpkieujwfv",
            fbp: ""
        };
        
        // Faz requisição para a API da LotoGreen para gerar o depósito
        const depositResponse = await axios.post('https://lotogreen.bet.br/api/deposits', {
            amount: amountInCents,
            params: params
        }, {
            headers: {
                'accept': 'application/json',
                'accept-language': 'pt,pt-PT;q=0.9,en-US;q=0.8,en;q=0.7',
                'authorization': `Bearer ${token}`,
                'content-type': 'application/json',
                'origin': 'https://lotogreen.bet.br',
                'referer': 'https://lotogreen.bet.br'
            }
        });
        
        // Verifica se o depósito foi processado com sucesso
        if (depositResponse.data && depositResponse.data.success) {
            return res.json(depositResponse.data);
        } else {
            return res.json({ 
                success: false, 
                message: 'Não foi possível processar o depósito'
            });
        }
    } catch (error) {
        console.error('Erro ao processar depósito:', error.message);
        return res.status(500).json({ 
            success: false, 
            message: 'Erro ao processar depósito'
        });
    }
});

// Endpoint para iniciar um jogo específico
app.get('/api/start-game/:gameId', async (req, res) => {
    try {
        // Obtém token do cabeçalho de autorização
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('Erro: Token não fornecido ou inválido');
            return res.status(401).json({ success: false, message: 'Token de autorização não fornecido' });
        }
        
        // Extrai o token e o ID do jogo
        const token = authHeader.split(' ')[1];
        const { gameId } = req.params;
        
        console.log(`Iniciando jogo ${gameId} com token: ${token.substring(0, 10)}...`);
        
        // Faz requisição para a API da LotoGreen para iniciar o jogo
        try {
            const gameResponse = await axios.get(`https://lotogreen.bet.br/api/casino-games/${gameId}/start?demo=0&isMobileDevice=1`, {
                headers: {
                    'accept': 'application/json',
                    'accept-language': 'pt',
                    'authorization': `Bearer ${token}`,
                    'content-type': 'application/json',
                    'origin': 'https://lotogreen.bet.br',
                    'referer': `https://lotogreen.bet.br/play/${gameId}`
                }
            });
            
            console.log('Resposta da API externa:', gameResponse.data);
            
            // Verifica se o jogo foi iniciado com sucesso
            if (gameResponse.data && gameResponse.data.success) {
                return res.json({
                    success: true,
                    link: gameResponse.data.link,
                    message: gameResponse.data.message
                });
            } else {
                console.log('Erro na resposta da API externa:', gameResponse.data);
                return res.json({ 
                    success: false, 
                    message: gameResponse.data.message || 'Não foi possível iniciar o jogo'
                });
            }
        } catch (apiError) {
            console.error('Erro na chamada à API externa:', apiError.message);
            if (apiError.response) {
                console.error('Detalhes do erro da API externa:', apiError.response.data);
                return res.status(apiError.response.status).json({ 
                    success: false, 
                    message: apiError.response.data.message || 'Erro ao iniciar jogo',
                    details: apiError.response.data
                });
            } else {
                throw apiError; // Repassa para o catch externo
            }
        }
    } catch (error) {
        console.error('Erro ao iniciar jogo:', error.message);
        return res.status(500).json({ 
            success: false, 
            message: 'Erro ao iniciar jogo',
            error: error.message
        });
    }
});

// Endpoint para registro de novos usuários
app.post('/api/register', async (req, res) => {
    try {
        // Obtém os dados do usuário do corpo da requisição
        const userData = req.body;
        
        // Configuração da requisição para o registro na API da LotoGreen
        const config = {
            method: 'post',
            url: 'https://lotogreen.bet.br/v2/auth/register',
            headers: {
                'accept': 'application/json',
                'accept-language': 'pt,pt-PT;q=0.9,en-US;q=0.8,en;q=0.7',
                'content-type': 'application/json',
                'origin': 'https://lotogreen.bet.br',
                'priority': 'u=1, i',
                'referer': 'https://lotogreen.bet.br/',
                'sec-ch-ua': '"Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"macOS"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-origin',
                'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
            },
            data: userData
        };

        // Envio da requisição de registro
        const response = await axios(config);
        
        // Retorna os dados de resposta do registro
        res.json(response.data);
    } catch (error) {
        console.error('Erro no registro:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json({
            success: false,
            message: error.response?.data?.message || 'Erro durante o registro',
            errors: error.response?.data?.errors || {}
        });
    }
});

// Inicialização do servidor na porta especificada
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
