async function garantirTabelaAuditoria(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS auditoria_eventos (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      evento VARCHAR(80) NOT NULL,
      entidade VARCHAR(60) NOT NULL,
      entidade_id VARCHAR(80),
      admin_id INT,
      admin_nome VARCHAR(100),
      detalhes JSON,
      ip VARCHAR(45),
      user_agent VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_auditoria_data (created_at),
      INDEX idx_auditoria_evento (evento),
      INDEX idx_auditoria_admin (admin_id)
    )
  `);
}

async function registrarAuditoria(conn, dados) {
  await garantirTabelaAuditoria(conn);
  await conn.query(
    `INSERT INTO auditoria_eventos
       (evento, entidade, entidade_id, admin_id, admin_nome, detalhes, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      dados.evento,
      dados.entidade,
      dados.entidadeId == null ? null : String(dados.entidadeId),
      dados.adminId || null,
      dados.adminNome || null,
      JSON.stringify(dados.detalhes || {}),
      dados.ip || null,
      dados.userAgent ? String(dados.userAgent).slice(0, 255) : null
    ]
  );
}

async function listarAuditoria(conn, filtros = {}) {
  await garantirTabelaAuditoria(conn);

  const condicoes = [];
  const parametros = [];

  if (filtros.evento) {
    condicoes.push('a.evento = ?');
    parametros.push(filtros.evento);
  }

  if (filtros.adminId) {
    condicoes.push('a.admin_id = ?');
    parametros.push(filtros.adminId);
  }

  if (filtros.busca) {
    condicoes.push('(a.evento LIKE ? OR a.entidade LIKE ? OR a.entidade_id LIKE ? OR a.admin_nome LIKE ?)');
    const termo = `%${filtros.busca}%`;
    parametros.push(termo, termo, termo, termo);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
  const limite = Math.min(Math.max(Number(filtros.limite || 100), 1), 300);

  const [rows] = await conn.query(
    `SELECT a.id, a.evento, a.entidade, a.entidade_id,
            a.admin_id, COALESCE(u.nome, a.admin_nome) AS admin_nome,
            a.detalhes, a.ip, a.user_agent,
            DATE_FORMAT(a.created_at, '%Y-%m-%d %H:%i:%s') AS created_at
     FROM auditoria_eventos a
     LEFT JOIN usuarios u ON u.id = a.admin_id
     ${where}
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT ?`,
    [...parametros, limite]
  );

  return rows.map((row) => ({
    ...row,
    detalhes: typeof row.detalhes === 'string' ? JSON.parse(row.detalhes || '{}') : (row.detalhes || {})
  }));
}

module.exports = {
  garantirTabelaAuditoria,
  registrarAuditoria,
  listarAuditoria
};
