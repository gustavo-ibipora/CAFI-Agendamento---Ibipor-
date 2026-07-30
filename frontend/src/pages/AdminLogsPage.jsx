import { useEffect, useState } from 'react';
import { apiJson } from '../api.js';
import { dataHoraBrasil } from '../utils.js';
import Message from '../components/Message.jsx';
import CampoDataInput from '../components/CampoDataInput.jsx';
import { useNavigate } from 'react-router-dom';

const ROTULOS_EVENTOS = {
  'admin.login_sucesso': 'Login',
  'admin.logout': 'Logout',
  'admin.usuario_criado': 'Usuário criado',
  'admin.usuario_atualizado': 'Usuário atualizado',
  'admin.usuario_excluido': 'Usuário excluído',
  'agendamento.status_atualizado': 'Status alterado',
  'agendamento.reagendado': 'Reagendamento',
  'agenda.horario_bloqueado': 'Horário bloqueado',
  'agenda.horario_desbloqueado': 'Horário desbloqueado',
  'agenda.dia_bloqueado': 'Dia bloqueado',
  'agenda.dia_desbloqueado': 'Dia desbloqueado'
};

const ITENS_POR_PAGINA = 10;

function resumoDetalhes(detalhes) {
  if (!detalhes || typeof detalhes !== 'object') return '';
  const pares = Object.entries(detalhes)
    .filter(([, valor]) => valor !== null && valor !== undefined && valor !== '')
    .slice(0, 6);

  return pares.map(([chave, valor]) => `${chave}: ${String(valor)}`).join(' | ');
}

export default function AdminLogsPage() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [evento, setEvento] = useState('');
  const [busca, setBusca] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [pagina, setPagina] = useState(1);
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    carregarLogs();
  }, []);

  async function carregarLogs(event) {
    if (event) event.preventDefault();
    setErro('');
    setCarregando(true);

    const params = new URLSearchParams();
    if (evento) params.set('evento', evento);
    if (busca.trim()) params.set('busca', busca.trim());

    try {
      const dados = await apiJson(`/api/admin/logs?${params.toString()}`);
      setLogs(dados.logs || []);
      setPagina(1);
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      setErro(err.message || 'Erro ao carregar logs.');
    } finally {
      setCarregando(false);
    }
  }

  function dataDoLog(log) {
    return String(log.created_at || '').slice(0, 10);
  }

  function dentroDoPeriodo(log) {
    const data = dataDoLog(log);
    if (dataInicio && data < dataInicio) return false;
    if (dataFim && data > dataFim) return false;
    return true;
  }

  function exportarCsv() {
    const linhas = logsFiltrados.map((log) => [
      dataHoraBrasil(log.created_at),
      ROTULOS_EVENTOS[log.evento] || log.evento,
      log.admin_nome || (log.admin_id ? `#${log.admin_id}` : '-'),
      `${log.entidade || ''}${log.entidade_id ? ` #${log.entidade_id}` : ''}`,
      resumoDetalhes(log.detalhes) || '-',
      log.ip || '-'
    ]);
    const csv = [['Data', 'Evento', 'Usuário', 'Entidade', 'Detalhes', 'IP'], ...linhas]
      .map((linha) => linha.map((valor) => `"${String(valor).replaceAll('"', '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'logs-administrativos.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const logsFiltrados = logs.filter(dentroDoPeriodo);
  const totalPaginas = Math.max(1, Math.ceil(logsFiltrados.length / ITENS_POR_PAGINA));
  const logsPagina = logsFiltrados.slice((pagina - 1) * ITENS_POR_PAGINA, pagina * ITENS_POR_PAGINA);

  return (
    <div className="cartao painel-logs-admin">
      <h2>Logs administrativos</h2>
      <form className="filtros" onSubmit={carregarLogs}>
        <div className="campo">
          <label htmlFor="log-evento">Evento</label>
          <select id="log-evento" value={evento} onChange={(e) => setEvento(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(ROTULOS_EVENTOS).map(([valor, rotulo]) => (
              <option key={valor} value={valor}>{rotulo}</option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="log-busca">Busca</label>
          <input id="log-busca" value={busca} placeholder="Evento, entidade, ID ou usuário" onChange={(e) => setBusca(e.target.value)} />
        </div>
        <CampoDataInput
          id="log-inicio"
          label="De"
          valorIso={dataInicio}
          onChangeIso={(valor) => { setDataInicio(valor); setPagina(1); }}
        />
        <CampoDataInput
          id="log-fim"
          label="Até"
          valorIso={dataFim}
          onChangeIso={(valor) => { setDataFim(valor); setPagina(1); }}
        />
        <div className="campo">
          <button type="submit" disabled={carregando}>{carregando ? 'Carregando...' : 'Atualizar'}</button>
        </div>
        <div className="campo">
          <button type="button" className="secundario" disabled={logsFiltrados.length === 0} onClick={exportarCsv}>Exportar CSV</button>
        </div>
      </form>

      <Message>{erro}</Message>

      <div className="tabela-responsiva logs-scroll">
        <table className="tabela-logs">
          <thead>
            <tr>
              <th>Data</th>
              <th>Evento</th>
              <th>Usuário</th>
              <th>Entidade</th>
              <th>Detalhes</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {carregando ? (
              Array.from({ length: 5 }).map((_, indice) => (
                <tr key={`log-carregando-${indice}`} className="linha-skeleton">
                  <td colSpan="6"><span /></td>
                </tr>
              ))
            ) : logsFiltrados.length === 0 ? (
              <tr>
                <td colSpan="6">Nenhum log encontrado.</td>
              </tr>
            ) : logsPagina.map((log) => (
              <tr key={log.id}>
                <td data-label="Data">{dataHoraBrasil(log.created_at)}</td>
                <td data-label="Evento"><strong>{ROTULOS_EVENTOS[log.evento] || log.evento}</strong></td>
                <td data-label="Usuário">{log.admin_nome || (log.admin_id ? `#${log.admin_id}` : '-')}</td>
                <td data-label="Entidade">{log.entidade}{log.entidade_id ? ` #${log.entidade_id}` : ''}</td>
                <td data-label="Detalhes">{resumoDetalhes(log.detalhes) || '-'}</td>
                <td data-label="IP">{log.ip || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {logsFiltrados.length > ITENS_POR_PAGINA && (
        <div className="paginacao">
          <button type="button" className="secundario" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button>
          <span>Página {pagina} de {totalPaginas}</span>
          <button type="button" className="secundario" disabled={pagina === totalPaginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button>
        </div>
      )}
    </div>
  );
}
