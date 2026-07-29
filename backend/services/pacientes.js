async function buscarPacientePorCpf(pool, cpf) {
  const [rows] = await pool.query(
    `SELECT cpf, nome_completo, data_nascimento, endereco, telefone, email, ubs
     FROM pacientes
     WHERE cpf = ? AND ativo = 1`,
    [cpf]
  );
  return rows[0] || null;
}

async function buscarPacienteEmAgendamentos(pool, cpf) {
  const [rows] = await pool.query(
    `SELECT cpf, nome_completo, data_nascimento, endereco, telefone, email, ubs
     FROM agendamentos
     WHERE cpf = ?
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [cpf]
  );
  return rows[0] || null;
}

async function salvarPaciente(conn, dados) {
  await conn.query(
    `INSERT INTO pacientes
      (cpf, nome_completo, data_nascimento, endereco, telefone, email, ubs, ativo)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       nome_completo = VALUES(nome_completo),
       data_nascimento = VALUES(data_nascimento),
       endereco = VALUES(endereco),
       telefone = VALUES(telefone),
       email = VALUES(email),
       ubs = VALUES(ubs),
       ativo = 1,
       updated_at = CURRENT_TIMESTAMP`,
    [
      dados.cpf,
      dados.nome_completo,
      dados.data_nascimento,
      dados.endereco,
      dados.telefone,
      dados.email,
      dados.ubs
    ]
  );
}

async function buscarOuImportarPacientePorCpf(pool, cpf) {
  const paciente = await buscarPacientePorCpf(pool, cpf);
  if (paciente) return paciente;

  const pacienteHistorico = await buscarPacienteEmAgendamentos(pool, cpf);
  if (!pacienteHistorico) return null;

  await salvarPaciente(pool, pacienteHistorico);
  return pacienteHistorico;
}

module.exports = {
  buscarPacientePorCpf,
  buscarPacienteEmAgendamentos,
  buscarOuImportarPacientePorCpf,
  salvarPaciente
};
