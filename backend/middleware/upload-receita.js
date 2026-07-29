const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const AppError = require('../utils/app-error');

const DIRETORIO_RECEITAS = path.join(__dirname, '..', 'uploads', 'receitas');
fs.mkdirSync(DIRETORIO_RECEITAS, { recursive: true });

const TIPOS_ACEITOS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};

const armazenamento = multer.diskStorage({
  destination: DIRETORIO_RECEITAS,
  filename(req, file, callback) {
    callback(null, `${crypto.randomUUID()}${TIPOS_ACEITOS[file.mimetype]}`);
  }
});

const uploadReceita = multer({
  storage: armazenamento,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter(req, file, callback) {
    if (!TIPOS_ACEITOS[file.mimetype]) {
      callback(new AppError(400, 'A receita deve ser um arquivo JPG, PNG ou PDF.', 'RECEITA_TIPO_INVALIDO'));
      return;
    }
    callback(null, true);
  }
}).single('receita');

function receberReceita(req, res, next) {
  uploadReceita(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(new AppError(400, 'A receita deve ter no maximo 5 MB.', 'RECEITA_MUITO_GRANDE'));
    }
    next(err);
  });
}

function removerArquivoReceita(arquivo) {
  if (arquivo) fs.unlink(arquivo.path, () => {});
}

module.exports = { receberReceita, removerArquivoReceita, DIRETORIO_RECEITAS };
