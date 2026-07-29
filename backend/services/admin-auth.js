const bcrypt = require('bcryptjs');

function normalizarRole(valor) {
  const role = String(valor || '').toUpperCase();
  if (role === 'OPERADOR') return 'OPERADOR';
  if (role === 'ADMIN') return 'ADMIN';
  return 'ADMIN';
}

async function buscarUsuarioEmAdmins(pool, usuario) {
  try {
    const [rows] = await pool.query(
      "SELECT id, nome, usuario, senha_hash, ativo, COALESCE(perfil, 'admin') AS role FROM admins WHERE usuario = ?",
      [usuario]
    );
    return rows;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return [];
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
    const [rows] = await pool.query(
      "SELECT id, nome, usuario, senha_hash, ativo, 'admin' AS role FROM admins WHERE usuario = ?",
      [usuario]
    );
    return rows;
  }
}

async function autenticarAdmin(pool, usuario, senha) {
  let rows;
  try {
    [rows] = await pool.query(
      "SELECT id, nome, usuario, senha_hash, ativo, COALESCE(role, 'ADMIN') AS role FROM usuarios WHERE usuario = ?",
      [usuario]
    );
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE' && err.code !== 'ER_BAD_FIELD_ERROR') throw err;
    rows = await buscarUsuarioEmAdmins(pool, usuario);
  }

  if (!rows[0]) {
    rows = await buscarUsuarioEmAdmins(pool, usuario);
  }
  const usuarioEncontrado = rows[0];
  if (!usuarioEncontrado || !usuarioEncontrado.ativo) return null;

  const senhaCorreta = await bcrypt.compare(senha, usuarioEncontrado.senha_hash);
  if (!senhaCorreta) return null;

  return {
    id: usuarioEncontrado.id,
    nome: usuarioEncontrado.nome,
    usuario: usuarioEncontrado.usuario,
    role: normalizarRole(usuarioEncontrado.role)
  };
}

module.exports = {
  autenticarAdmin,
  normalizarRole
};
