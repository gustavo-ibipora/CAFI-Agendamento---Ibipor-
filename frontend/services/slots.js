const { ehDiaUtil } = require('./datas');
const { salvarPaciente } = require('./pacientes');

const CAPACIDADE_POR_BLOCO = 8;
const LIMITE_ATB_DIA = 10;
const INICIO = '08:00';
const FIM = '16:15';
const PAUSAS = new Set(['09:45', '13:00', '15:00']);
const STATUS_OCUPA_VAGA = new Set(['confirmado', 'atendido', 'faltou']);
const STATUS_REAGENDAVEIS = new Set(['confirmado', 'cancelado']);
let blocosDiaCache = null;

function paraMinutos(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function paraHHMM(minutos) {
  const h = String(Math.floor(minutos / 60)).padStart(2, '0');
  const m = String(minutos % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function gerarBlocosDia() {
  if (blocosDiaCache) return blocosDiaCache;

  const blocos = [];
  for (let m = paraMinutos(INICIO); m <= paraMinutos(FIM); m += 15) {
    const hhmm = paraHHMM(m);
    if (!PAUSAS.has(hhmm)) blocos.push(hhmm);
  }
  blocosDiaCache = blocos;
  return blocosDiaCache;
}

function horarioValido(horario) {
  return gerarBlocosDia().includes(horario);
}

function condicaoStatusOcupaVaga() {
  return "status IN ('confirmado', 'atendido', 'faltou')";
}

function dataBancoParaISO(valor) {
  if (!(valor instanceof Date)) return String(valor).slice(0, 10);

  const ano = valor.getFullYear();
  const mes = String(valor.getMonth() + 1).padStart(2, '0');
  const dia = String(valor.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

function extrairHorarioHHMM(valor) {
  const str = String(valor || '');
  const match = str.match(/(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : str.slice(0, 5);
}

async function garantirSlotsDia(conn, data) {
  const valores = gerarBlocosDia().map((horario) => [data, horario, CAPACIDADE_POR_BLOCO, 0]);
  await conn.query(
    `INSERT IGNORE INTO slots_agenda (data_agendamento, horario, capacidade, ocupadas)
     VALUES ?`,
    [valores]
  );
}

async function garantirTabelaBloqueios(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS bloqueios_agenda (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      data_agendamento DATE NOT NULL,
      horario TIME NOT NULL,
      motivo VARCHAR(255),
      admin_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_bloqueio_horario (data_agendamento, horario),
      INDEX idx_bloqueios_data (data_agendamento)
    )
  `);
}

async function garantirTabelaContadores(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS contadores_diarios (
      data DATE NOT NULL,
      tipo VARCHAR(50) NOT NULL,
      valor INT NOT NULL DEFAULT 0,
      PRIMARY KEY (data, tipo)
    )
  `);
}

async function horariosDisponiveis(pool, data, primeiroAtendimento, agendamentoIgnoradoId = null) {
  const vagasNecessarias = primeiroAtendimento ? 2 : 1;

  await garantirSlotsDia(pool, data);
  let agendamentoIgnorado = null;

  if (agendamentoIgnoradoId) {
    const [rows] = await pool.query(
      `SELECT data_agendamento, horario, vagas_ocupadas, status
       FROM agendamentos
       WHERE id = ?`,
      [agendamentoIgnoradoId]
    );
    agendamentoIgnorado = rows[0] || null;
  }

  const [rows] = await pool.query(
    `SELECT horario, capacidade, ocupadas
     FROM slots_agenda
     WHERE data_agendamento = ?
     ORDER BY horario`,
    [data]
  );

  return rows.map((row) => {
    const horario = extrairHorarioHHMM(row.horario);
    let ocupadas = row.ocupadas;
    if (
      agendamentoIgnorado &&
      STATUS_OCUPA_VAGA.has(agendamentoIgnorado.status) &&
      dataBancoParaISO(agendamentoIgnorado.data_agendamento) === data &&
      extrairHorarioHHMM(agendamentoIgnorado.horario) === horario
    ) {
      ocupadas = Math.max(ocupadas - agendamentoIgnorado.vagas_ocupadas, 0);
    }
    const vagasRestantes = row.capacidade - ocupadas;
    return {
      horario,
      vagasRestantes,
      disponivel: vagasRestantes >= vagasNecessarias
    };
  });
}

async function criarAgendamento(pool, dados) {
  const {
    data_agendamento,
    horario,
    primeiro_atendimento,
    tipo_medicamento
  } = dados;

  if (!ehDiaUtil(data_agendamento)) {
    const err = new Error('A farmacia so atende de segunda a sexta.');
    err.codigo = 'DIA_INVALIDO';
    throw err;
  }
  if (!horarioValido(horario)) {
    const err = new Error('Horario invalido.');
    err.codigo = 'HORARIO_INVALIDO';
    throw err;
  }

  const vagasNecessarias = primeiro_atendimento ? 2 : 1;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await garantirSlotsDia(conn, data_agendamento);
    await garantirTabelaContadores(conn);
    await salvarPaciente(conn, dados);

    const [agendamentosPaciente] = await conn.query(
      `SELECT COUNT(*) AS total
       FROM agendamentos
       WHERE cpf = ? AND data_agendamento = ? AND status IN ('confirmado', 'atendido', 'faltou')`,
      [dados.cpf, data_agendamento]
    );
    if (agendamentosPaciente[0].total > 0) {
      const err = new Error('Você já possui um agendamento para esta data.');
      err.codigo = 'LIMITE_DIARIO_PACIENTE';
      throw err;
    }

    const [slotResult] = await conn.query(
      `UPDATE slots_agenda
       SET ocupadas = ocupadas + ?
       WHERE data_agendamento = ? AND horario = ? AND ocupadas + ? <= capacidade`,
      [vagasNecessarias, data_agendamento, horario, vagasNecessarias]
    );
    if (slotResult.affectedRows === 0) {
      const err = new Error('Este horario acabou de lotar. Escolha outro.');
      err.codigo = 'HORARIO_LOTADO';
      throw err;
    }

    if (tipo_medicamento === 'Antibiotico') {
      await conn.query(
        `INSERT IGNORE INTO contadores_diarios (data, tipo, valor) VALUES (?, 'Antibiotico', 0)`,
        [data_agendamento]
      );
      const [atbResult] = await conn.query(
        `UPDATE contadores_diarios
         SET valor = valor + 1
         WHERE data = ? AND tipo = 'Antibiotico' AND valor < ?`,
        [data_agendamento, LIMITE_ATB_DIA]
      );
      if (atbResult.affectedRows === 0) {
        const err = new Error('O limite diario de retiradas de Antibiotico ja foi atingido. Escolha outro dia.');
        err.codigo = 'LIMITE_ATB';
        throw err;
      }
    }

    const [result] = await conn.query(
      `INSERT INTO agendamentos
        (nome_completo, cpf, data_nascimento, endereco, telefone, email, ubs,
         tipo_medicamento, primeiro_atendimento, previsao_termino, observacoes,
         data_agendamento, horario, vagas_ocupadas, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmado')`,
      [
        dados.nome_completo,
        dados.cpf,
        dados.data_nascimento,
        dados.endereco,
        dados.telefone,
        dados.email,
        dados.ubs,
        tipo_medicamento,
        primeiro_atendimento ? 1 : 0,
        dados.previsao_termino,
        dados.observacoes || null,
        data_agendamento,
        horario,
        vagasNecessarias
      ]
    );

    await conn.commit();
    return result.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function atualizarStatusAgendamento(pool, agendamentoId, novoStatus, adminId = null) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, data_agendamento, horario, vagas_ocupadas, status, tipo_medicamento
       FROM agendamentos
       WHERE id = ?
       FOR UPDATE`,
      [agendamentoId]
    );
    const agendamento = rows[0];
    if (!agendamento) {
      await conn.rollback();
      return { encontrado: false };
    }

    const statusAnteriorOcupa = STATUS_OCUPA_VAGA.has(agendamento.status);
    const statusNovoOcupa = STATUS_OCUPA_VAGA.has(novoStatus);
    const data = dataBancoParaISO(agendamento.data_agendamento);
    const horario = extrairHorarioHHMM(agendamento.horario);

    await garantirSlotsDia(conn, data);

    if (statusAnteriorOcupa && !statusNovoOcupa) {
      await conn.query(
        `UPDATE slots_agenda
         SET ocupadas = GREATEST(ocupadas - ?, 0)
         WHERE data_agendamento = ? AND horario = ?`,
        [agendamento.vagas_ocupadas, data, horario]
      );
      if (agendamento.tipo_medicamento === 'Antibiotico') {
        await conn.query(
          `UPDATE contadores_diarios
           SET valor = GREATEST(valor - 1, 0)
           WHERE data = ? AND tipo = 'Antibiotico'`,
          [data]
        );
      }
    }

    if (!statusAnteriorOcupa && statusNovoOcupa) {
      const [slotResult] = await conn.query(
        `UPDATE slots_agenda
         SET ocupadas = ocupadas + ?
         WHERE data_agendamento = ? AND horario = ? AND ocupadas + ? <= capacidade`,
        [agendamento.vagas_ocupadas, data, horario, agendamento.vagas_ocupadas]
      );
      if (slotResult.affectedRows === 0) {
        const err = new Error('Este horario nao possui vagas suficientes para reativar o agendamento.');
        err.codigo = 'HORARIO_LOTADO';
        throw err;
      }
      
      if (agendamento.tipo_medicamento === 'Antibiotico') {
        await garantirTabelaContadores(conn);
        await conn.query(
          `INSERT IGNORE INTO contadores_diarios (data, tipo, valor) VALUES (?, 'Antibiotico', 0)`,
          [data]
        );
        const [atbResult] = await conn.query(
          `UPDATE contadores_diarios
           SET valor = valor + 1
           WHERE data = ? AND tipo = 'Antibiotico' AND valor < ?`,
          [data, LIMITE_ATB_DIA]
        );
        if (atbResult.affectedRows === 0) {
          const err = new Error('O limite diario de retiradas de Antibiotico ja foi atingido para este dia.');
          err.codigo = 'LIMITE_ATB';
          throw err;
        }
      }
    }

    await conn.query('UPDATE agendamentos SET status = ?, updated_by = ? WHERE id = ?', [novoStatus, adminId || null, agendamentoId]);
    await conn.commit();

    return {
      encontrado: true,
      statusAnterior: agendamento.status,
      statusNovo: novoStatus
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function reagendarAgendamento(pool, agendamentoId, dataNova, horarioNovo, adminId = null) {
  if (!ehDiaUtil(dataNova)) {
    const err = new Error('A farmacia so atende de segunda a sexta.');
    err.codigo = 'DIA_INVALIDO';
    throw err;
  }
  if (!horarioValido(horarioNovo)) {
    const err = new Error('Horario invalido.');
    err.codigo = 'HORARIO_INVALIDO';
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT id, data_agendamento, horario, vagas_ocupadas, status, tipo_medicamento
       FROM agendamentos
       WHERE id = ?
       FOR UPDATE`,
      [agendamentoId]
    );
    const agendamento = rows[0];
    if (!agendamento) {
      await conn.rollback();
      return { encontrado: false };
    }

    const dataAnterior = dataBancoParaISO(agendamento.data_agendamento);
    const horarioAnterior = extrairHorarioHHMM(agendamento.horario);
    const statusAnterior = agendamento.status;
    const ocupaVaga = STATUS_OCUPA_VAGA.has(statusAnterior);

    if (!STATUS_REAGENDAVEIS.has(statusAnterior)) {
      const err = new Error(`Agendamentos com status '${statusAnterior}' nao podem ser reagendados.`);
      err.codigo = 'STATUS_NAO_REAGENDAVEL';
      throw err;
    }

    if (dataAnterior === dataNova && horarioAnterior === horarioNovo) {
      await conn.rollback();
      return { encontrado: true, semAlteracao: true, dataAnterior, horarioAnterior };
    }

    await garantirSlotsDia(conn, dataAnterior);
    await garantirSlotsDia(conn, dataNova);

    if (ocupaVaga) {
      await conn.query(
        `UPDATE slots_agenda
         SET ocupadas = GREATEST(ocupadas - ?, 0)
         WHERE data_agendamento = ? AND horario = ?`,
        [agendamento.vagas_ocupadas, dataAnterior, horarioAnterior]
      );

      const [slotResult] = await conn.query(
        `UPDATE slots_agenda
         SET ocupadas = ocupadas + ?
         WHERE data_agendamento = ? AND horario = ? AND ocupadas + ? <= capacidade`,
        [agendamento.vagas_ocupadas, dataNova, horarioNovo, agendamento.vagas_ocupadas]
      );
      if (slotResult.affectedRows === 0) {
        const err = new Error('Este horario nao possui vagas suficientes para reagendar.');
        err.codigo = 'HORARIO_LOTADO';
        throw err;
      }

      if (agendamento.tipo_medicamento === 'Antibiotico' && dataAnterior !== dataNova) {
        await garantirTabelaContadores(conn);
        await conn.query(
          `INSERT IGNORE INTO contadores_diarios (data, tipo, valor) VALUES (?, 'Antibiotico', 0)`,
          [dataNova]
        );
        const [atbResult] = await conn.query(
          `UPDATE contadores_diarios
           SET valor = valor + 1
           WHERE data = ? AND tipo = 'Antibiotico' AND valor < ?`,
          [dataNova, LIMITE_ATB_DIA]
        );
        if (atbResult.affectedRows === 0) {
          const err = new Error('O limite diario de retiradas de Antibiotico ja foi atingido nesse dia.');
          err.codigo = 'LIMITE_ATB';
          throw err;
        }

        await conn.query(
          `UPDATE contadores_diarios
           SET valor = GREATEST(valor - 1, 0)
           WHERE data = ? AND tipo = 'Antibiotico'`,
          [dataAnterior]
        );
      }
    }

    let novoStatus = statusAnterior;
    if (statusAnterior === 'cancelado') {
      novoStatus = 'confirmado';
    } else if (ocupaVaga && statusAnterior === 'confirmado') {
      novoStatus = 'confirmado';
    }

    const [updateResult] = await conn.query(
      "UPDATE agendamentos SET data_agendamento = ?, horario = ?, status = ?, updated_by = ? WHERE id = ?",
      [dataNova, horarioNovo, novoStatus, adminId || null, agendamentoId]
    );

    if (updateResult.affectedRows === 0) {
      const err = new Error('Falha ao atualizar agendamento. Tente novamente.');
      err.codigo = 'FALHA_ATUALIZACAO';
      throw err;
    }

    await conn.commit();
    return {
      encontrado: true,
      dataAnterior,
      horarioAnterior,
      dataNova,
      horarioNovo,
      statusAnterior,
      statusNovo: novoStatus
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function bloquearHorario(pool, data, horario, motivo, adminId) {
  if (!ehDiaUtil(data)) {
    const err = new Error('A farmacia so atende de segunda a sexta.');
    err.codigo = 'DIA_INVALIDO';
    throw err;
  }
  if (!horarioValido(horario)) {
    const err = new Error('Horario invalido.');
    err.codigo = 'HORARIO_INVALIDO';
    throw err;
  }

  await garantirTabelaBloqueios(pool);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await garantirSlotsDia(conn, data);

    const [slotRows] = await conn.query(
      `SELECT ocupadas
       FROM slots_agenda
       WHERE data_agendamento = ? AND horario = ?
       FOR UPDATE`,
      [data, horario]
    );

    if (!slotRows[0]) {
      const err = new Error('Horario invalido.');
      err.codigo = 'HORARIO_INVALIDO';
      throw err;
    }
    if (slotRows[0].ocupadas > 0) {
      const err = new Error('Nao e possivel bloquear um horario que ja possui agendamentos.');
      err.codigo = 'HORARIO_COM_AGENDAMENTOS';
      throw err;
    }

    await conn.query(
      `INSERT INTO bloqueios_agenda (data_agendamento, horario, motivo, admin_id, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE motivo = VALUES(motivo), admin_id = VALUES(admin_id), updated_by = VALUES(updated_by), created_at = CURRENT_TIMESTAMP`,
      [data, horario, motivo || null, adminId || null, adminId || null]
    );
    await conn.query(
      `UPDATE slots_agenda
       SET capacidade = 0, ocupadas = 0
       WHERE data_agendamento = ? AND horario = ?`,
      [data, horario]
    );

    await conn.commit();
    return { data, horario };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function desbloquearHorario(pool, bloqueioId) {
  await garantirTabelaBloqueios(pool);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id, data_agendamento, horario
       FROM bloqueios_agenda
       WHERE id = ?
       FOR UPDATE`,
      [bloqueioId]
    );
    const bloqueio = rows[0];
    if (!bloqueio) {
      await conn.rollback();
      return { encontrado: false };
    }

    const data = dataBancoParaISO(bloqueio.data_agendamento);
    const horario = extrairHorarioHHMM(bloqueio.horario);
    await conn.query('DELETE FROM bloqueios_agenda WHERE id = ?', [bloqueioId]);
    await conn.query(
      `UPDATE slots_agenda
       SET capacidade = ?
       WHERE data_agendamento = ? AND horario = ?`,
      [CAPACIDADE_POR_BLOCO, data, horario]
    );
    await conn.commit();
    return { encontrado: true, data, horario };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  CAPACIDADE_POR_BLOCO,
  LIMITE_ATB_DIA,
  STATUS_OCUPA_VAGA,
  STATUS_REAGENDAVEIS,
  gerarBlocosDia,
  garantirSlotsDia,
  garantirTabelaBloqueios,
  horarioValido,
  ehDiaUtil,
  horariosDisponiveis,
  criarAgendamento,
  atualizarStatusAgendamento,
  reagendarAgendamento,
  bloquearHorario,
  desbloquearHorario,
  extrairHorarioHHMM
};
