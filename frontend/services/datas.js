const TIMEZONE_SISTEMA = 'America/Sao_Paulo';
const DATA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

function dataHojeISO() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_SISTEMA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

function ehDataISO(dataStr) {
  if (!DATA_ISO_RE.test(String(dataStr || ''))) return false;

  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));

  return (
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia
  );
}

function diaSemanaISO(dataStr) {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
}

function ehDiaUtil(dataStr) {
  if (!ehDataISO(dataStr)) return false;
  const diaSemana = diaSemanaISO(dataStr);
  return diaSemana >= 1 && diaSemana <= 5;
}

function compararDatasISO(a, b) {
  return String(a).localeCompare(String(b));
}

function adicionarDiasISO(dataStr, dias) {
  const [ano, mes, dia] = String(dataStr).split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias));
  const anoFinal = data.getUTCFullYear();
  const mesFinal = String(data.getUTCMonth() + 1).padStart(2, '0');
  const diaFinal = String(data.getUTCDate()).padStart(2, '0');
  return `${anoFinal}-${mesFinal}-${diaFinal}`;
}

function dataAmanhaISO() {
  return adicionarDiasISO(dataHojeISO(), 1);
}

module.exports = {
  TIMEZONE_SISTEMA,
  dataHojeISO,
  dataAmanhaISO,
  adicionarDiasISO,
  ehDataISO,
  ehDiaUtil,
  compararDatasISO
};
