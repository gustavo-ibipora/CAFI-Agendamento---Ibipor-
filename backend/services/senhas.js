function validarSenhaForte(senha) {
  const erros = [];

  if (senha.length < 10) erros.push('ter pelo menos 10 caracteres');
  if (!/[a-z]/.test(senha)) erros.push('ter uma letra minuscula');
  if (!/[A-Z]/.test(senha)) erros.push('ter uma letra maiuscula');
  if (!/\d/.test(senha)) erros.push('ter um numero');
  if (!/[^A-Za-z0-9]/.test(senha)) erros.push('ter um caractere especial');

  return erros;
}

function mensagemSenhaForte(erros) {
  return `A senha deve ${erros.join(', ')}.`;
}

module.exports = {
  validarSenhaForte,
  mensagemSenhaForte
};
