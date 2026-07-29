const UBS_PADRAO = [
  'Centro de Saude Dr. Eugenio Dal Molin',
  'UBS San Rafael',
  'UBS Perola',
  'UBS Bom Pastor',
  'UBS La Fontaine',
  'UBS Vila Esperanca',
  'UBS Taquara do Reino',
  'UBS Jhon Kennedy',
  'UBS Serraia'
];

const TIPOS_MEDICAMENTO_PADRAO = [
  'Antibiotico',
  'Medicamento Controlado',
  'Medicamento do Estado (CEAF)',
  'Nao sei'
];

async function listarDominios(pool) {
  const [ubsRows] = await pool.query(
    'SELECT nome FROM ubs WHERE ativo = 1 ORDER BY ordem, nome'
  );
  const [tipoRows] = await pool.query(
    'SELECT nome FROM tipos_medicamento WHERE ativo = 1 ORDER BY ordem, nome'
  );

  return {
    ubs: ubsRows.map((row) => row.nome),
    tiposMedicamento: tipoRows.map((row) => row.nome)
  };
}

module.exports = {
  UBS_PADRAO,
  TIPOS_MEDICAMENTO_PADRAO,
  listarDominios
};
