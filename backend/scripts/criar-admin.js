const bcrypt = require('bcryptjs');
const pool = require('../db');
const { validarSenhaForte, mensagemSenhaForte } = require('../services/senhas');

async function main() {
  const [, , usuario, senha, ...nomeArr] = process.argv;
  const nome = nomeArr.join(' ') || usuario;

  if (!usuario || !senha) {
    console.log('Uso: node scripts/criar-admin.js <usuario> <senha> [nome completo]');
    process.exit(1);
  }
  const errosSenha = validarSenhaForte(senha);
  if (errosSenha.length > 0) {
    console.log(mensagemSenhaForte(errosSenha));
    process.exit(1);
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  try {
    await pool.query(
      "INSERT INTO usuarios (nome, usuario, senha_hash, role, ativo) VALUES (?, ?, ?, 'ADMIN', 1)",
      [nome, usuario, senhaHash]
    );
    try {
      await pool.query(
        "INSERT IGNORE INTO admins (nome, usuario, senha_hash, perfil, ativo) VALUES (?, ?, ?, 'admin', 1)",
        [nome, usuario, senhaHash]
      );
    } catch (err) {
      if (err.code !== 'ER_BAD_FIELD_ERROR' && err.code !== 'ER_NO_SUCH_TABLE') throw err;
    }
    console.log(`Administrador "${usuario}" criado com sucesso.`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.log(`Já existe um administrador com o usuário "${usuario}".`);
    } else {
      console.error('Erro ao criar administrador:', err.message);
    }
  } finally {
    await pool.end();
  }
}

main();
