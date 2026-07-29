export async function apiJson(url, options = {}) {
  let resp;
  try {
    resp = await fetch(url, options);
  } catch (err) {
    throw new Error('Erro de conexao com o servidor.');
  }

  let dados = {};
  try {
    dados = await resp.json();
  } catch (err) {
    dados = {};
  }

  if (!resp.ok) {
    const erro = new Error(dados.erro || 'Não foi possível concluir a operação.');
    erro.status = resp.status;
    erro.codigo = dados.codigo;
    erro.dados = dados;
    throw erro;
  }

  return dados;
}

export function jsonOptions(body, method = 'POST') {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

export function formDataOptions(campos, method = 'POST') {
  const dados = new FormData();
  Object.entries(campos).forEach(([chave, valor]) => {
    if (valor === undefined || valor === null || valor === '') return;
    dados.append(chave, valor);
  });
  return { method, body: dados };
}
