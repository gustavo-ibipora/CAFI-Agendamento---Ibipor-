const pool = require('../db');
const { gerarBlocosDia, garantirSlotsDia, CAPACIDADE_POR_BLOCO } = require('../services/slots');

const DATA_TESTE = '2026-07-27';
const TOTAL_POR_HORARIO = CAPACIDADE_POR_BLOCO;
const CPF_BASE = 73000000000;
const OBSERVACAO_TESTE = '[TESTE_AGENDA_CHEIA_20260703]';

function gerarCpfSequencial(indice) {
  const base = String(CPF_BASE + indice).padStart(11, '0').slice(0, 11);
  return base;
}

function pacienteTeste(indice, horario) {
  const numero = String(indice).padStart(3, '0');
  return {
    nome_completo: `Paciente Teste Agenda Cheia ${numero}`,
    cpf: gerarCpfSequencial(indice),
    data_nascimento: '1985-07-03',
    endereco: `Rua Teste ${numero}, Ibipora-PR`,
    telefone: `4399${String(1000000 + indice).slice(1)}`,
    email: `paciente.teste.${numero}@example.com`,
    ubs: 'UBS San Rafael',
    tipo_medicamento: 'Medicamento Controlado',
    primeiro_atendimento: 0,
    previsao_termino: '2026-08-10',
    observacoes: `${OBSERVACAO_TESTE} Horario ${horario}`,
    data_agendamento: DATA_TESTE,
    vagas_ocupadas: 1,
    status: 'confirmado'
  };
}

async function main() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await garantirSlotsDia(conn, DATA_TESTE);

    await conn.query(
      `DELETE FROM agendamentos
       WHERE data_agendamento = ? AND observacoes LIKE ?`,
      [DATA_TESTE, `${OBSERVACAO_TESTE}%`]
    );

    await conn.query(
      `DELETE FROM pacientes
       WHERE email LIKE 'paciente.teste.%@example.com'`
    );

    const horarios = gerarBlocosDia();
    await conn.query(
      `UPDATE slots_agenda
       SET capacidade = ?
       WHERE data_agendamento = ?`,
      [CAPACIDADE_POR_BLOCO, DATA_TESTE]
    );

    const [ocupacoesExistentes] = await conn.query(
      `SELECT TIME_FORMAT(horario, '%H:%i') AS horario, COALESCE(SUM(vagas_ocupadas), 0) AS ocupadas
       FROM agendamentos
       WHERE data_agendamento = ?
         AND status IN ('confirmado', 'atendido', 'faltou')
       GROUP BY horario`,
      [DATA_TESTE]
    );
    const ocupadasPorHorario = new Map(
      ocupacoesExistentes.map((row) => [row.horario, Number(row.ocupadas)])
    );

    let indice = 1;
    let totalInserido = 0;
    for (const horario of horarios) {
      const ocupadasExistentes = ocupadasPorHorario.get(horario) || 0;
      const vagasParaInserir = Math.max(TOTAL_POR_HORARIO - ocupadasExistentes, 0);

      for (let vaga = 1; vaga <= vagasParaInserir; vaga += 1) {
        const paciente = pacienteTeste(indice, horario);

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
            paciente.cpf,
            paciente.nome_completo,
            paciente.data_nascimento,
            paciente.endereco,
            paciente.telefone,
            paciente.email,
            paciente.ubs
          ]
        );

        await conn.query(
          `INSERT INTO agendamentos
            (nome_completo, cpf, data_nascimento, endereco, telefone, email, ubs,
             tipo_medicamento, primeiro_atendimento, previsao_termino, observacoes,
             data_agendamento, horario, vagas_ocupadas, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            paciente.nome_completo,
            paciente.cpf,
            paciente.data_nascimento,
            paciente.endereco,
            paciente.telefone,
            paciente.email,
            paciente.ubs,
            paciente.tipo_medicamento,
            paciente.primeiro_atendimento,
            paciente.previsao_termino,
            paciente.observacoes,
            paciente.data_agendamento,
            horario,
            paciente.vagas_ocupadas,
            paciente.status
          ]
        );

        indice += 1;
        totalInserido += 1;
      }

      await conn.query(
        `UPDATE slots_agenda
         SET ocupadas = LEAST(?, capacidade)
         WHERE data_agendamento = ? AND horario = ?`,
        [ocupadasExistentes + vagasParaInserir, DATA_TESTE, horario]
      );
    }

    await conn.commit();
    console.log(`Agenda de teste preenchida para ${DATA_TESTE}.`);
    console.log(`${horarios.length} horarios x ${TOTAL_POR_HORARIO} vagas = ${horarios.length * TOTAL_POR_HORARIO} vagas ocupadas no total.`);
    console.log(`${totalInserido} agendamentos de teste inseridos nesta execucao.`);
  } catch (err) {
    await conn.rollback();
    console.error('Erro ao preencher agenda de teste:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
