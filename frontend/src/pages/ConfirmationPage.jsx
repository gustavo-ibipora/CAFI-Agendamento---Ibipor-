import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dataBrasil, formatarCpf } from '../utils.js';
import Message from '../components/Message.jsx';

export default function ConfirmationPage() {
  const [dados, setDados] = useState(null);

  useEffect(() => {
    const bruto = sessionStorage.getItem('ultimoAgendamento');
    if (!bruto) return;

    try {
      setDados(JSON.parse(bruto));
    } catch (err) {
      setDados(null);
    } finally {
      sessionStorage.removeItem('ultimoAgendamento');
    }
  }, []);

  if (!dados?.agendamento) {
    return (
      <main className="pagina-confirmacao">
        <h1 className="sr-only">Agendamento não encontrado</h1>
        <div className="cartao cartao-sem-dados">
          <h2>Nenhum agendamento encontrado</h2>
          <p>Não encontramos os dados do seu agendamento nesta sessão.</p>
          <div className="acoes">
            <Link className="botao" to="/agendamento">Fazer um novo agendamento</Link>
            <Link className="botao secundario" to="/">Voltar ao início</Link>
          </div>
        </div>
      </main>
    );
  }

  const ag = dados.agendamento;
  const avisoEmail = dados.email?.enviado
    ? `Um e-mail de confirmação foi enviado para ${ag.email}.`
    : dados.email?.enfileirado
      ? `A confirmação por e-mail foi agendada para ${ag.email}.`
      : '';
  const horarioFormatado = String(ag.horario || '').slice(0, 5);
  const dadosComprovante = [
    ['Protocolo', `#${ag.id}`],
    ['Nome', ag.nome_completo],
    ['CPF', formatarCpf(ag.cpf)],
    ['Data', dataBrasil(ag.data_agendamento)],
    ['Horário', horarioFormatado],
    ['UBS de origem', ag.ubs],
    ['Medicamento', ag.tipo_medicamento],
    ['Primeiro atendimento', ag.primeiro_atendimento ? 'Sim' : 'Não']
  ];

  function quebrarTexto(texto, maxCaracteres) {
    const palavras = texto.split(' ');
    const linhas = [];
    let linhaAtual = '';
    for (const palavra of palavras) {
      if ((linhaAtual + palavra).length > maxCaracteres) {
        linhas.push(linhaAtual.trim());
        linhaAtual = palavra + ' ';
      } else {
        linhaAtual += palavra + ' ';
      }
    }
    linhas.push(linhaAtual.trim());
    return linhas;
  }

  if (ag.observacoes) {
    const linhasObs = quebrarTexto(ag.observacoes, 50);
    linhasObs.forEach((linha, idx) => {
      dadosComprovante.push([idx === 0 ? 'Observações' : '', linha]);
    });
  }

  function salvarComprovanteComoImagem() {
    const escala = 2;
    const largura = 760;
    const padding = 44;
    const alturaLinha = 38;
    const altura = padding * 2 + 112 + dadosComprovante.length * alturaLinha;
    const canvas = document.createElement('canvas');
    canvas.width = largura * escala;
    canvas.height = altura * escala;

    const ctx = canvas.getContext('2d');
    ctx.scale(escala, escala);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, largura, altura);

    ctx.fillStyle = '#1a3050';
    ctx.font = '700 24px Inter, Segoe UI, Arial, sans-serif';
    ctx.fillText('Comprovante de agendamento', padding, padding + 8);

    ctx.fillStyle = '#5a6a78';
    ctx.font = '500 15px Inter, Segoe UI, Arial, sans-serif';
    ctx.fillText('CAFI', padding, padding + 36);

    ctx.strokeStyle = '#dde8f2';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding + 62);
    ctx.lineTo(largura - padding, padding + 62);
    ctx.stroke();

    let y = padding + 100;
    dadosComprovante.forEach(([rotulo, valor]) => {
      ctx.fillStyle = '#2E4A70';
      ctx.font = '700 15px Inter, Segoe UI, Arial, sans-serif';
      ctx.fillText(rotulo, padding, y);

      ctx.fillStyle = rotulo === 'Protocolo' ? '#1a3050' : '#1e2b38';
      ctx.font = `${rotulo === 'Protocolo' ? '800' : '500'} 16px Inter, Segoe UI, Arial, sans-serif`;
      ctx.fillText(String(valor || '-'), padding + 210, y);
      y += alturaLinha;
    });

    ctx.fillStyle = '#5a6a78';
    ctx.font = '500 13px Inter, Segoe UI, Arial, sans-serif';
    ctx.fillText('Leve um documento com foto no dia da retirada.', padding, altura - padding + 6);

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `comprovante-agendamento-${ag.id}.png`;
    link.click();
  }

  return (
    <main className="pagina-confirmacao">
      <h1 className="sr-only">Agendamento confirmado</h1>
      <div className="cartao confirmacao-cartao">
        {/* Ícone de sucesso */}
        <div className="confirmacao-icone" aria-hidden="true">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>

        <h2>Agendamento confirmado!</h2>

        {avisoEmail && (
          <Message type="sucesso">{avisoEmail}</Message>
        )}

        <p className="confirmacao-instrucao">
          Anote ou salve as informações abaixo. Chegue com alguns minutos de
          antecedência e leve um <strong>documento com foto</strong>.
        </p>

        <div className="comprovante">
          <h3 className="comprovante-titulo">Comprovante de agendamento</h3>
          <dl>
            <dt>Protocolo</dt>
            <dd className="protocolo-num">#{ag.id}</dd>
            <dt>Nome</dt>
            <dd>{ag.nome_completo}</dd>
            <dt>CPF</dt>
            <dd>{formatarCpf(ag.cpf)}</dd>
            <dt>Data</dt>
            <dd>{dataBrasil(ag.data_agendamento)}</dd>
            <dt>Horário</dt>
            <dd className="horario-destaque">{horarioFormatado}</dd>
            <dt>UBS de origem</dt>
            <dd>{ag.ubs}</dd>
            <dt>Medicamento</dt>
            <dd>{ag.tipo_medicamento}</dd>
            <dt>Primeiro atendimento</dt>
            <dd>{ag.primeiro_atendimento ? 'Sim' : 'Não'}</dd>
            {ag.observacoes && (
              <>
                <dt>Observações</dt>
                <dd>{ag.observacoes}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="acoes">
          <button type="button" id="btn-imprimir" onClick={() => window.print()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
            </svg>
            Imprimir comprovante
          </button>
          <button type="button" className="secundario" id="btn-salvar-imagem" onClick={salvarComprovanteComoImagem}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Salvar como imagem
          </button>
          <Link className="botao secundario" to="/agendamento" id="btn-novo-agendamento">
            Novo agendamento
          </Link>
        </div>
      </div>
    </main>
  );
}
