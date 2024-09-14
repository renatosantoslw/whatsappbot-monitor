// server.js
console.log(`- Server Web-http: inicializando...`);

const express = require('express');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const basicAuth = require('express-basic-auth');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuração de autenticação básica para todas as rotas
/*
app.use(basicAuth({
  users: { 'admin': '12345' },  // Configura os usuários e senhas
  challenge: true,                  // Habilita o desafio, mostrando o prompt de login no navegador
  realm: 'example'                  // Definir o realm opcionalmente
}));
*/

// Configuração de autenticação básica para rotas especificas
const authMiddleware = basicAuth({
  users: { [process.env.AUTH_USER] : process.env.AUTH_PASS },
  challenge: true,
  realm: 'example'
});

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Diretório que você deseja listar
const directoryPath = path.join(__dirname, 'downloads');

// Rota para verificar se o servidor está ativo
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/listar/v1',authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'listarv1.html'));
});

app.get('/listar/v2',authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'listarv2.html'));
});

// Rota para verificar se o servidor está ativo
/*
app.get('/', (req, res) => {
  res.send(`
    <h2>- Servidor Ativo</h2>
    <p><a href="/files">-Listar arquivos</a></p>
    <p><a href="/files/download-all">-Baixar arquivos</a></p>
  `);
});
*/

const downloadFolder = path.join(__dirname, 'downloads'); // Defina o caminho da pasta

// Rota para listar arquivos com paginação
app.get('/listararquivos',authMiddleware ,(req, res) => {
  const page = parseInt(req.query.page) || 1; // Página atual (por padrão, 1)
  const limit = parseInt(req.query.limit) || 5; // Limite de arquivos por página (por padrão, 5)
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  // Ler a pasta de downloads e obter os arquivos
  fs.readdir(downloadFolder, (err, files) => {
      if (err) {
          return res.status(500).send('Erro ao listar arquivos');
      }

      // Obter detalhes dos arquivos (tamanho, data de criação, etc.)
      const arquivos = files.map(file => {
          const stats = fs.statSync(path.join(downloadFolder, file));
          return {
              nome: file,
              tamanho: (stats.size / 1024).toFixed(2), // tamanho em KB
              dataCriacao: stats.mtime
          };
      });

      const paginatedFiles = arquivos.slice(startIndex, endIndex);

      // Responder com os arquivos paginados e a contagem total
      res.json({
          totalFiles: arquivos.length,  // Total de arquivos
          totalPages: Math.ceil(arquivos.length / limit),  // Total de páginas
          currentPage: page,  // Página atual
          arquivos: paginatedFiles  // Arquivos para esta página
      });
  });
});

// Rota para download
app.get('/download/:nomeArquivo',authMiddleware, (req, res) => {
  const arquivo = req.params.nomeArquivo;
  const filePath = path.join(downloadFolder, arquivo);

  res.download(filePath, err => {
      if (err) {
          res.status(500).send('Erro ao baixar o arquivo');
      }
  });
});

// Rota para listar arquivos
app.get('/files',authMiddleware, (req, res) => {
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return res.status(500).send('Não foi possível listar os arquivos.');
    }
    res.json(files);
  });
});

// Rota para baixar um arquivo específico
app.get('/files/download/:filename',authMiddleware, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(directoryPath, filename);

  // Verifica se o arquivo existe
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send('Arquivo não encontrado.');
    }

    // Envia o arquivo como resposta
    res.download(filePath, (err) => {
      if (err) {
        res.status(500).send('Erro ao baixar o arquivo.');
      }
    });
  });
});

// Rota para deletar um arquivo específico
app.delete('/files/delete/:filename',authMiddleware, (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(directoryPath, filename);

  // Verifica se o arquivo existe
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).send('Arquivo não encontrado.');
    }

    // Deleta o arquivo
    fs.unlink(filePath, (err) => {
      if (err) {
        return res.status(500).send('Erro ao deletar o arquivo.');
      }
      res.send('Arquivo deletado com sucesso.');
    });
  });
});

// Rota para deletar todos os arquivos
app.delete('/files/delete-all',authMiddleware, (req, res) => {
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return res.status(500).send('Não foi possível listar os arquivos para exclusão.');
    }

    if (files.length === 0) {
      return res.send('Nenhum arquivo para deletar.');
    }

    // Deleta todos os arquivos
    let deleteCount = 0;
    let errorOccurred = false;

    files.forEach((file) => {
      const filePath = path.join(directoryPath, file);
      fs.unlink(filePath, (err) => {
        if (err) {
          errorOccurred = true;
          console.error(`Erro ao deletar o arquivo ${file}:`, err);
        } else {
          deleteCount++;
        }

        // Verifica se todos os arquivos foram processados
        if (deleteCount + (errorOccurred ? 1 : 0) === files.length) {
          if (errorOccurred) {
            res.status(500).send('Alguns arquivos não puderam ser deletados.');
          } else {
            res.send('Todos os arquivos foram deletados com sucesso.');
          }
        }
      });
    });
  });
});

// Rota para baixar todos os arquivos compactados em um arquivo zip
app.get('/files/download-all',authMiddleware, (req, res) => {
  // Cria um arquivo zip
  const zip = archiver('zip', {
    zlib: { level: 9 } // Compressão máxima
  });

  res.attachment('arquivos.zip'); // Nome do arquivo zip para download

  // Cria o fluxo de saída para o zip
  zip.pipe(res);

  // Adiciona arquivos ao zip
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      return res.status(500).send('Não foi possível listar os arquivos para compressão.');
    }

    if (files.length === 0) {
      zip.finalize();
      return res.send('Nenhum arquivo para compactar.');
    }

    files.forEach((file) => {
      const filePath = path.join(directoryPath, file);
      zip.file(filePath, { name: file });
    });

    zip.finalize();
  });
});

app.listen(PORT, () => {
  console.log(`- Server Web-http: inicializado. PORTA: ${PORT}`);
});

module.exports = app;
