function log(nivel, evento, dados = {}) {
  const registro = {
    timestamp: new Date().toISOString(),
    nivel,
    evento,
    ...dados
  };

  const linha = JSON.stringify(registro);
  if (nivel === 'error') {
    console.error(linha);
    return;
  }
  console.log(linha);
}

module.exports = {
  info: (evento, dados) => log('info', evento, dados),
  warn: (evento, dados) => log('warn', evento, dados),
  error: (evento, dados) => log('error', evento, dados)
};
