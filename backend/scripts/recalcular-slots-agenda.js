const pool = require('../db');
const { STATUS_OCUPA_VAGA, CAPACIDADE_POR_BLOCO } = require('../services/slots');

// Corrige slots_agenda.ocupadas/capacidade quando agendamentos foram inseridos
// diretamente no banco (ex: importação de planilha), sem passar por
// slots.criarAgendamento — que é o único lugar que normalmente mantém esse
// contador em dia. Sem isso, a tela de agendamento mostra o horário como
// livre mesmo já tendo gente marcada.
//
// Uso: node scripts/recalcular-slots-agenda.js
//      node scripts/recalcular-slots-agenda.js --data-inicio=2026-08-01 --data-fim=2026-09-30
async function main() {
  const argumentos = process.argv.slice(2);
  const dataInicio = argumentos
    .find((a) => a.startsWith('--data-inicio='))
    ?.split('=')[1];
  const dataFim = argumentos
    .find((a) => a.startsWith('--data-fim='))
    ?.split('=')[1];

  const statusPlaceholders = [...STATUS_OCUPA_VAGA].map(() => '?').join(', ');
  const where = [`status IN (${statusPlaceholders})`];
  const parametros = [...STATUS_OCUPA_VAGA];
  if (dataInicio) {
    where.push('data_agendamento >= ?');
    parametros.push(dataInicio);
  }
  if (dataFim) {
    where.push('data_agendamento <= ?');
    parametros.push(dataFim);
  }

  const [linhas] = await pool.query(
    `SELECT DATE_FORMAT(data_agendamento, '%Y-%m-%d') AS data_agendamento,
            TIME_FORMAT(horario, '%H:%i:%S') AS horario,
            SUM(vagas_ocupadas) AS total_ocupadas
     FROM agendamentos
     WHERE ${where.join(' AND ')}
     GROUP BY data_agendamento, horario`,
    parametros
  );

  console.log(`Encontrados ${linhas.length} horários com agendamentos ativos${dataInicio || dataFim ? ' no período informado' : ''}.`);

  let ajustados = 0;
  let capacidadeAumentada = 0;

  for (const linha of linhas) {
    const totalOcupadas = Number(linha.total_ocupadas);
    const capacidadeMinima = Math.max(CAPACIDADE_POR_BLOCO, totalOcupadas);

    const [resultado] = await pool.query(
      `INSERT INTO slots_agenda (data_agendamento, horario, capacidade, ocupadas)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         capacidade = GREATEST(capacidade, VALUES(capacidade)),
         ocupadas = VALUES(ocupadas)`,
      [linha.data_agendamento, linha.horario, capacidadeMinima, totalOcupadas]
    );

    if (resultado.affectedRows > 0) ajustados += 1;
    if (capacidadeMinima > CAPACIDADE_POR_BLOCO) capacidadeAumentada += 1;
  }

  console.log(`Slots ajustados: ${ajustados}.`);
  console.log(`Slots que precisaram de capacidade acima do padrão (${CAPACIDADE_POR_BLOCO}): ${capacidadeAumentada}.`);
  console.log('Recalculo concluído.');
}

main()
  .catch((err) => {
    console.error('Erro ao recalcular slots_agenda:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
