import { useEffect, useState } from 'react';
import { apiJson } from '../api.js';
import { dataBrasil, hojeISO } from '../utils.js';
import Message from '../components/Message.jsx';
import CampoDataInput from '../components/CampoDataInput.jsx';
import { useNavigate } from 'react-router-dom';

const ROTULOS_STATUS = {
  confirmado: 'Confirmados',
  presente: 'Presente',
  atendido: 'Atendidos',
  faltou: 'Faltas',
  cancelado: 'Cancelados'
};

const cards = [
  ['agendamentos', 'Agendamentos', 'azul'],
  ['atendidos', 'Atendidos', 'verde'],
  ['faltas', 'Faltas', 'amarelo'],
  ['cancelados', 'Cancelados', 'vermelho'],
  ['horariosBloqueados', 'Horarios bloqueados', 'roxo'],
  ['vagasOcupadas', 'Vagas ocupadas', 'cinza']
];

function linhasCsv(relatorio) {
  const totais = relatorio?.totais || {};
  
  const linhas = [];

  linhas.push(['--- RESUMO GERAL ---']);
  linhas.push(['Agendamentos', totais.agendamentos || 0]);
  linhas.push(['Atendidos', totais.atendidos || 0]);
  linhas.push(['Faltas', totais.faltas || 0]);
  linhas.push(['Cancelados', totais.cancelados || 0]);
  linhas.push(['Horários bloqueados', totais.horariosBloqueados || 0]);
  linhas.push(['Vagas ocupadas', totais.vagasOcupadas || 0]);
  linhas.push([]);

  linhas.push(['--- DEMANDA POR UBS ---']);
  linhas.push(['UBS', 'Total']);
  (relatorio?.porUbs || []).forEach((item) => {
    linhas.push([item.nome, item.total]);
  });
  linhas.push([]);

  linhas.push(['--- DEMANDA POR TIPO DE MEDICAMENTO ---']);
  linhas.push(['Medicamento', 'Total']);
  (relatorio?.porMedicamento || []).forEach((item) => {
    linhas.push([item.nome, item.total]);
  });
  linhas.push([]);

  linhas.push(['--- AGENDAMENTOS POR DIA ---']);
  linhas.push(['Data', 'Agendamentos', 'Atendidos', 'Faltas', 'Cancelados']);
  (relatorio?.porDia || []).forEach((item) => {
    linhas.push([dataBrasil(item.data), item.total, item.atendidos, item.faltas, item.cancelados]);
  });

  return linhas.map((linha) => linha.map((valor) => `"${String(valor ?? '').replaceAll('"', '""')}"`).join(';')).join('\n');
}

export default function AdminReportsPage() {
  const navigate = useNavigate();
  const [dataInicio, setDataInicio] = useState(hojeISO());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [ubs, setUbs] = useState('');
  const [medicamento, setMedicamento] = useState('');
  const [status, setStatus] = useState('');
  const [opcoesUbs, setOpcoesUbs] = useState([]);
  const [opcoesMedicamento, setOpcoesMedicamento] = useState([]);
  const [relatorio, setRelatorio] = useState(null);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarOpcoes();
    carregarRelatorio();
  }, []);

  async function carregarOpcoes() {
    try {
      const dados = await apiJson('/api/agendamentos/opcoes');
      setOpcoesUbs(dados.ubs || []);
      setOpcoesMedicamento(dados.tiposMedicamento || []);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar filtros.');
    }
  }

  async function carregarRelatorio(evento, sobrescritas = {}) {
    evento?.preventDefault();
    setErro('');
    setCarregando(true);

    const filtroDataInicio = sobrescritas.dataInicio ?? dataInicio;
    const filtroDataFim = sobrescritas.dataFim ?? dataFim;
    const filtroUbs = sobrescritas.ubs ?? ubs;
    const filtroMedicamento = sobrescritas.medicamento ?? medicamento;
    const filtroStatus = sobrescritas.status ?? status;
    const params = new URLSearchParams();
    if (filtroDataInicio) params.set('data_inicio', filtroDataInicio);
    if (filtroDataFim) params.set('data_fim', filtroDataFim);
    if (filtroUbs) params.set('ubs', filtroUbs);
    if (filtroMedicamento) params.set('tipo_medicamento', filtroMedicamento);
    if (filtroStatus) params.set('status', filtroStatus);

    try {
      const dados = await apiJson(`/api/admin/relatorios/agendamentos?${params.toString()}`);
      setRelatorio(dados);
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      setRelatorio(null);
      setErro(err.message || 'Erro ao gerar relatorio.');
    } finally {
      setCarregando(false);
    }
  }

  function gerarGeral() {
    setDataInicio('');
    setDataFim('');
    setUbs('');
    setMedicamento('');
    setStatus('');
    carregarRelatorio(null, { dataInicio: '', dataFim: '', ubs: '', medicamento: '', status: '' });
  }

  function exportarCsv() {
    if (!relatorio) return;
    const blob = new Blob([`\uFEFF${linhasCsv(relatorio)}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'relatorio-agendamentos.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  function exportarXLS() {
    const params = new URLSearchParams();
    if (dataInicio) params.set('data_inicio', dataInicio);
    if (dataFim) params.set('data_fim', dataFim);
    if (ubs) params.set('ubs', ubs);
    if (medicamento) params.set('tipo_medicamento', medicamento);
    if (status) params.set('status', status);

    window.location.href = `/api/admin/agendamentos/exportar?${params.toString()}`;
  }

  const totais = relatorio?.totais || {};
  const maiorUbs = Math.max(1, ...(relatorio?.porUbs || []).map((item) => item.total));
  const maiorMedicamento = Math.max(1, ...(relatorio?.porMedicamento || []).map((item) => item.total));

  return (
    <div className="cartao painel-relatorios-admin">
      <h2>Relatorios de agendamentos</h2>
      <form className="filtros" onSubmit={carregarRelatorio}>
        <CampoDataInput
          id="rel-inicio"
          label="De"
          valorIso={dataInicio}
          onChangeIso={(nova) => setDataInicio(nova)}
        />
        <CampoDataInput
          id="rel-fim"
          label="Ate"
          valorIso={dataFim}
          onChangeIso={(nova) => setDataFim(nova)}
        />
        <div className="campo">
          <label htmlFor="rel-ubs">UBS</label>
          <select id="rel-ubs" value={ubs} onChange={(e) => setUbs(e.target.value)}>
            <option value="">Todas</option>
            {opcoesUbs.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="rel-medicamento">Medicamento</label>
          <select id="rel-medicamento" value={medicamento} onChange={(e) => setMedicamento(e.target.value)}>
            <option value="">Todos</option>
            {opcoesMedicamento.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="rel-status">Status</label>
          <select id="rel-status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ROTULOS_STATUS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>{rotulo}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <button type="submit" disabled={carregando}>{carregando ? 'Gerando...' : 'Gerar'}</button>
        </div>
        <div className="campo">
          <button type="button" className="secundario" onClick={gerarGeral}>Geral</button>
        </div>
        <div className="campo">
          <button type="button" className="secundario" disabled={!relatorio} onClick={exportarCsv}>Exportar CSV (Resumo)</button>
        </div>
        <div className="campo">
          <button type="button" className="secundario" style={{ borderColor: '#217346', color: '#217346' }} onClick={exportarXLS}>Lista de Presença (XLS)</button>
        </div>
      </form>

      <Message>{erro}</Message>

      <div className="grade-relatorios">
        {cards.map(([chave, rotulo, cor]) => (
          <article key={chave} className={`relatorio-card relatorio-card-${cor}`}>
            <span>{rotulo}</span>
            <strong>{totais[chave] || 0}</strong>
          </article>
        ))}
      </div>

      <div className="relatorios-grid">
        <section className="painel-admin-bloco">
          <h3>Demanda por UBS</h3>
          <div className="lista-relatorio">
            {(relatorio?.porUbs || []).length === 0 ? (
              <span>Nenhum dado encontrado.</span>
            ) : relatorio.porUbs.map((item) => (
              <div key={item.nome} className="linha-relatorio linha-relatorio-ubs">
                <span>{item.nome}</span>
                <strong>{item.total}</strong>
                <i style={{ width: `${Math.max(6, (item.total / maiorUbs) * 100)}%` }} />
              </div>
            ))}
          </div>
        </section>

        <section className="painel-admin-bloco">
          <h3>Demanda por tipo de medicamento</h3>
          <div className="lista-relatorio">
            {(relatorio?.porMedicamento || []).length === 0 ? (
              <span>Nenhum dado encontrado.</span>
            ) : relatorio.porMedicamento.map((item) => (
              <div key={item.nome} className="linha-relatorio linha-relatorio-medicamento">
                <span>{item.nome}</span>
                <strong>{item.total}</strong>
                <i style={{ width: `${Math.max(6, (item.total / maiorMedicamento) * 100)}%` }} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="tabela-responsiva logs-scroll">
        <table className="tabela-logs">
          <thead>
            <tr>
              <th>Data</th>
              <th>Agendamentos</th>
              <th>Atendidos</th>
              <th>Faltas</th>
              <th>Cancelados</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              Array.from({ length: 4 }).map((_, indice) => (
                <tr key={`rel-carregando-${indice}`} className="linha-skeleton">
                  <td colSpan="5"><span /></td>
                </tr>
              ))
            ) : (relatorio?.porDia || []).length === 0 ? (
              <tr>
                <td colSpan="5">Nenhum agendamento encontrado.</td>
              </tr>
            ) : relatorio.porDia.map((dia) => (
              <tr key={dia.data}>
                <td data-label="Data">{dataBrasil(dia.data)}</td>
                <td data-label="Agendamentos">{dia.total}</td>
                <td data-label="Atendidos"><span className="valor-relatorio valor-atendido">{dia.atendidos}</span></td>
                <td data-label="Faltas"><span className="valor-relatorio valor-falta">{dia.faltas}</span></td>
                <td data-label="Cancelados"><span className="valor-relatorio valor-cancelado">{dia.cancelados}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
