// bot.js
console.log('- Client Whatsapp: inicializando...');
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
        console.error('\x1b[33m%s\x1b[0m','- Erro ao salvar a mensagem no arquivo de log:\n', error);
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
        console.error('\x1b[33m%s\x1b[0m','- Erro ao salvar arquivo de mídia:\n', error);
        return null;
    }
};

// Configuração do cliente WhatsApp com LocalAuth
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "cliente_android", // Nome da pasta para a sessão
        dataPath: path.join(__dirname, 'session_data') // Caminho personalizado para armazenar a sessão
    }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
    }
});

// Evento para gerar o QR code (somente na primeira inicialização)
client.on('qr', qr => {
    console.log('- Client Whatsapp: Gerando QR code...');
    qrcode.generate(qr, { small: true });
});

// Evento quando o cliente está autenticado
client.on('authenticated', () => {
    console.log('- Client Whatsapp: autenticado com sucesso.');
});

// Evento quando o cliente está pronto
client.on('ready', () => {
    console.log('- Client Whatsapp: pronto para uso.');
    console.log('\x1b[32m%s\x1b[0m', '- Serviços inicializados...\n- Monitorando evento: message_create\n');
});

// Evento para capturar falhas de autenticação
client.on('auth_failure', () => {
    console.error('\x1b[33m%s\x1b[0m','- Client Whatsapp: Falha na autenticação.');
});

// Evento para lidar com desconexão
client.on('disconnected', reason => {
    console.log('- Client Whatsapp: desconectado. Motivo:', reason);
});

// Inicializa o cliente
client.initialize().then(() => {
    console.log('- Client Whatsapp: inicializado.');
}).catch(err => {
    console.log('\x1b[33m%s\x1b[0m', '- Client Whatsapp: Erro na inicialização:\n', err);
    process.exit(1); // Encerra o processo com um código de erro
});

// Número de telefone do contato a ser monitorado
const specificContact = process.env.CONTATO;

// Evento para lidar com mensagens recebidas
client.on('message_create', async msg => {
    await delay(1000); // Atraso para simular resposta mais natural
    const userId = msg.from;
   
    // Responder mensagem enviada pelo bot
    if (msg.fromMe){
        // Responder ao comando de status
        if (msg.body.toLowerCase() === '/status') {
        await msg.reply('✅ • Client Whatsapp ATIVO\n'+
                        '✅ • Server Web-http ATIVO\n'+
                        'http//:localhost:5000');        
        return;
        }   
    }

    // Lógica para salvar mensagens de um contato específico
    if (msg.from === specificContact) {
        saveMessageToFile(userId, msg.body);    
        
        // Lógica para salvar mídia de um contato específico
        if (msg.hasMedia || msg._data.isViewOnce) {
            const media = await msg.downloadMedia();
            if (media) {
                const fileName = await saveMediaToFile(media, userId, msg.body);

                /*
                fs.writeFileSync(
                    `${msg.type === 'image'
                        ? `./image-${Date.now()}.png`
                        : msg.type === 'video'
                            ? `./video-${Date.now()}.mp4`
                            : `./ptt-${Date.now()}.mp3`}`,
                    Buffer.from(media.data, 'base64')
                );
                */
            }
        }
    }

});

module.exports = client;
