export function hojeISO() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());

  const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${mapa.year}-${mapa.month}-${mapa.day}`;
}

export function adicionarDiasISO(dataStr, dias) {
  const [ano, mes, dia] = String(dataStr).split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias));
  const anoFinal = data.getUTCFullYear();
  const mesFinal = String(data.getUTCMonth() + 1).padStart(2, '0');
  const diaFinal = String(data.getUTCDate()).padStart(2, '0');
  return `${anoFinal}-${mesFinal}-${diaFinal}`;
}

export function amanhaISO() {
  return adicionarDiasISO(hojeISO(), 1);
}

export function somenteDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

export function aplicarMascaraCpf(valor) {
  return somenteDigitos(valor)
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

export function aplicarMascaraData(valor) {
  return somenteDigitos(valor)
    .slice(0, 8)
    .replace(/(\d{2})(\d)/, '$1/$2')
    .replace(/(\d{2})(\d)/, '$1/$2');
}

export function dataBrParaIso(valor) {
  const digitos = somenteDigitos(valor);
  if (digitos.length !== 8) return '';

  const dia = digitos.slice(0, 2);
  const mes = digitos.slice(2, 4);
  const ano = digitos.slice(4, 8);
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
  const dataValida = data.getFullYear() === Number(ano) && data.getMonth() === Number(mes) - 1 && data.getDate() === Number(dia);
  return dataValida ? `${ano}-${mes}-${dia}` : '';
}

export function dataIsoParaBr(valor) {
  const [ano, mes, dia] = String(valor || '').slice(0, 10).split('-');
  if (!ano || !mes || !dia) return '';
  return `${dia}/${mes}/${ano}`;
}

export function aplicarMascaraDataHifen(valor) {
  return somenteDigitos(valor)
    .slice(0, 8)
    .replace(/(\d{2})(\d)/, '$1-$2')
    .replace(/(\d{2})(\d)/, '$1-$2');
}

export function dataBrHifenParaIso(valor) {
  const digitos = somenteDigitos(valor);
  if (digitos.length !== 8) return '';

  const dia = digitos.slice(0, 2);
  const mes = digitos.slice(2, 4);
  const ano = digitos.slice(4, 8);
  const data = new Date(Number(ano), Number(mes) - 1, Number(dia));
  const dataValida = data.getFullYear() === Number(ano) && data.getMonth() === Number(mes) - 1 && data.getDate() === Number(dia);
  return dataValida ? `${ano}-${mes}-${dia}` : '';
}

export function dataIsoParaBrHifen(valor) {
  const [ano, mes, dia] = String(valor || '').slice(0, 10).split('-');
  if (!ano || !mes || !dia) return '';
  return `${dia}-${mes}-${ano}`;
}


export function aplicarMascaraTelefone(valor) {
  const digitos = somenteDigitos(valor).slice(0, 11);
  if (digitos.length <= 10) {
    return digitos
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  return digitos
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export function cpfValido(cpfBruto) {
  const cpf = somenteDigitos(cpfBruto);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const calcularDigito = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (base.length + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const digito1 = calcularDigito(cpf.slice(0, 9));
  const digito2 = calcularDigito(cpf.slice(0, 9) + digito1);
  return cpf === cpf.slice(0, 9) + String(digito1) + String(digito2);
}

export function telefoneValido(telefone) {
  const digitos = somenteDigitos(telefone);
  return digitos.length === 10 || digitos.length === 11;
}

export function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function senhaForteValida(senha) {
  return (
    String(senha || '').length >= 10 &&
    /[a-z]/.test(senha) &&
    /[A-Z]/.test(senha) &&
    /\d/.test(senha) &&
    /[^A-Za-z0-9]/.test(senha)
  );
}

export function dataBrasil(data) {
  if (!data) return '';
  const dataIso = String(data).slice(0, 10);
  return new Date(`${dataIso}T00:00:00`).toLocaleDateString('pt-BR');
}

export function dataHoraBrasil(valor) {
  if (!valor) return '';
  const normalizado = String(valor).replace(' ', 'T');
  return new Date(normalizado).toLocaleString('pt-BR');
}

export function formatarCpf(cpf) {
  return String(cpf || '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function ehFimDeSemana(dataStr) {
  const [ano, mes, dia] = dataStr.split('-').map(Number);
  const diaSemana = new Date(ano, mes - 1, dia).getDay();
  return diaSemana === 0 || diaSemana === 6;
}
