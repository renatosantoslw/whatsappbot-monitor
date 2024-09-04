// bot.js
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

require('dotenv').config();

// Função para adicionar atraso nas respostas
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Função para salvar uma mensagem em um arquivo de log
const saveMessageToFile = (userId, message) => {
    const logFilePath = path.join(__dirname, 'downloads/messages_log.txt');
    const logMessage = `-[${new Date().toLocaleString()}] - ${userId}: ${message}\n`;
    try {
        fs.appendFileSync(logFilePath, logMessage);
        console.log(`${logMessage.trim()}`);
    } catch (error) {
        console.error('Erro ao salvar a mensagem no arquivo de log:', error);
    }
};

// Função para salvar mídia recebida
const saveMediaToFile = async (media, userId, message) => {
    const logMessage = `-[${new Date().toLocaleString()}] - ${userId}: ${message}\n`;
    const fileName = media.filename || `file_${Date.now()}.${media.mimetype.split('/')[1]}`;
    const filePath = path.join(__dirname, 'downloads', fileName);

    try {
        fs.writeFileSync(filePath, media.data, { encoding: 'base64' });
        console.log(`${logMessage.trim()}:${fileName}`);
        return fileName;
    } catch (error) {
        console.error('Erro ao salvar arquivo de mídia:', error);
        return null;
    }
};

// Configuração do cliente WhatsApp com LocalAuth
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "cliente_1", // Nome da pasta para a sessão
        dataPath: path.join(__dirname, 'session_data') // Caminho personalizado para armazenar a sessão
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
    }
});

// Evento para gerar o QR code (somente na primeira inicialização)
client.on('qr', qr => {
    console.log('- Gerando QR code...');
    qrcode.generate(qr, { small: true });
});

// Evento quando o cliente está autenticado
client.on('authenticated', () => {
    console.log('- Cliente autenticado com sucesso.');
});

// Evento quando o cliente está pronto
client.on('ready', () => {
    console.log('- Cliente está pronto para uso.');
    console.log('\x1b[32m%s\x1b[0m', '- Monitoramento iniciado...\n');
});

// Evento para capturar falhas de autenticação
client.on('auth_failure', () => {
    console.error('- Falha na autenticação.');
});

// Evento para lidar com desconexão
client.on('disconnected', reason => {
    console.log('- Cliente desconectado. Motivo:', reason);
});

// Inicializa o cliente
client.initialize().then(() => {
    console.log('- Cliente inicialização completa.');
}).catch(err => {
    console.error('Erro na inicialização:', err);
});

const specificContact = process.env.CONTATO; // Substitua pelo número de telefone do contato específico

// Evento para lidar com mensagens recebidas
client.on('message', async msg => {
    await delay(1000); // Atraso para simular resposta mais natural
    const userId = msg.from;

    // Responder ao comando de status
    if (msg.body.startsWith('/status')) {
        client.sendMessage(userId, '- Ativo');
        return;
    }

    // Lógica para salvar mensagens de um contato específico
    if (msg.from === specificContact) {
        saveMessageToFile(userId, msg.body);
    }

    // Lógica para salvar mídia de um contato específico
    if (msg.hasMedia && msg.from === specificContact) {
        const media = await msg.downloadMedia();
        if (media) {
            const fileName = await saveMediaToFile(media, userId, msg.body);
        }
    }
});

module.exports = client;
