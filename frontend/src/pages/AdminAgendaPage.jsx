import { useEffect, useRef, useState } from 'react';
import { apiJson, jsonOptions } from '../api.js';
import { dataBrasil, dataHoraBrasil, formatarCpf, hojeISO, aplicarMascaraData, dataBrParaIso, dataIsoParaBr } from '../utils.js';
import Message from '../components/Message.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import CampoDataInput from '../components/CampoDataInput.jsx';
import useModalScrollLock from '../hooks/useModalScrollLock.js';
import AdminCreateUserPage from './AdminCreateUserPage.jsx';
import AdminLogsPage from './AdminLogsPage.jsx';
import AdminReportsPage from './AdminReportsPage.jsx';
import { useNavigate, Link } from 'react-router-dom';

const ROTULOS_STATUS = {
  confirmado: 'Confirmado',
  cancelado: 'Cancelado',
  atendido: 'Atendido',
  faltou: 'Faltou',
  presente: 'Presente'
};

const ITENS_POR_PAGINA = 10;
const INTERVALO_ATUALIZACAO_MS = 8000;
const DURACAO_DESTAQUE_MS = 1600;

export default function AdminAgendaPage({ setHeaderNav, setCanManageUsers, abaInicial = 'agenda' }) {
  const agendaRequestRef = useRef(0);
  const filtrosRef = useRef({ data: '', ubs: '', medicamento: '', status: '', busca: '' });
  const agendamentosRef = useRef([]);
  const detalheRef = useRef(null);
  const confirmacaoRef = useRef(null);
  const carregandoRef = useRef(false);
  const atualizacaoSilenciosaEmVooRef = useRef(false);
  const destaqueTimeoutRef = useRef(null);
  const detalheModalRef = useRef(null);
  const detalheFecharRef = useRef(null);
  const detalheBotaoAnteriorRef = useRef(null);
  const navigate = useNavigate();
  const dataPickerRef = useRef(null);
  const [nomeAdmin, setNomeAdmin] = useState('');
  const [verificado, setVerificado] = useState(false); // evita flash de conteúdo antes de confirmar sessão
  const [podeGerenciarUsuarios, setPodeGerenciarUsuarios] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState(abaInicial);
  const [data, setData] = useState(hojeISO());
  const [dataTexto, setDataTexto] = useState(dataIsoParaBr(hojeISO()));
  const [ubs, setUbs] = useState('');
  const [medicamento, setMedicamento] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [buscaAgenda, setBuscaAgenda] = useState('');
  const [opcoesUbs, setOpcoesUbs] = useState([]);
  const [opcoesMedicamento, setOpcoesMedicamento] = useState([]);
  const [agendamentos, setAgendamentos] = useState([]);
  const [bloqueios, setBloqueios] = useState([]);
  const [horariosBloqueio, setHorariosBloqueio] = useState([]);
  const [novoBloqueio, setNovoBloqueio] = useState({ horario: '', motivo: '' });
  const [erro, setErro] = useState('');
  const [resumo, setResumo] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [detalhe, setDetalhe] = useState(null);
  const [reagendamento, setReagendamento] = useState({ data: data, horario: '', horarios: [], carregando: false, salvando: false });
  const [ordenacao, setOrdenacao] = useState({ coluna: 'horario', direcao: 'asc' });
  const [paginaAgenda, setPaginaAgenda] = useState(1);
  const [confirmacao, setConfirmacao] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [idsAtualizados, setIdsAtualizados] = useState(() => new Set());

  // Refs sincronizadas a cada render para leitura sem "stale closures" dentro do polling em segundo plano.
  filtrosRef.current = { data, ubs, medicamento, status: statusFiltro, busca: buscaAgenda };
  agendamentosRef.current = agendamentos;
  detalheRef.current = detalhe;
  confirmacaoRef.current = confirmacao;
  carregandoRef.current = carregando;

  useEffect(() => {
    verificarSessao();
  }, []);

  useEffect(() => {
    setAbaAtiva(abaInicial);
  }, [abaInicial]);

  useEffect(() => {
    if (verificado && data && abaAtiva === 'agenda') {
      carregarBloqueios(data);
      carregarHorariosBloqueio(data);
    }
  }, [verificado, data, abaAtiva]);

  useEffect(() => {
    if (!verificado || abaAtiva !== 'agenda') return undefined;

    const timeout = setTimeout(() => {
      carregarAgenda(null);
    }, 350);

    return () => clearTimeout(timeout);
  }, [verificado, abaAtiva, data, ubs, medicamento, statusFiltro, buscaAgenda]);

  // Atualização em segundo plano: mantém a agenda em dia entre operadores sem
  // recarregar a tabela nem piscar a tela — só re-renderiza quando algo realmente muda.
  useEffect(() => {
    if (!verificado || abaAtiva !== 'agenda') return undefined;

    const intervalo = setInterval(() => {
      if (document.hidden) return;
      if (carregandoRef.current || atualizacaoSilenciosaEmVooRef.current) return;
      if (detalheRef.current || confirmacaoRef.current) return;
      atualizarAgendaSilenciosa();
    }, INTERVALO_ATUALIZACAO_MS);

    return () => clearInterval(intervalo);
  }, [verificado, abaAtiva]);

  // Ao voltar para a aba do navegador, atualiza na hora em vez de esperar o próximo ciclo.
  useEffect(() => {
    if (!verificado || abaAtiva !== 'agenda') return undefined;

    function aoMudarVisibilidade() {
      if (document.hidden) return;
      if (carregandoRef.current || atualizacaoSilenciosaEmVooRef.current) return;
      if (detalheRef.current || confirmacaoRef.current) return;
      atualizarAgendaSilenciosa();
    }

    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    return () => document.removeEventListener('visibilitychange', aoMudarVisibilidade);
  }, [verificado, abaAtiva]);

  useEffect(() => {
    return () => {
      if (destaqueTimeoutRef.current) clearTimeout(destaqueTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (detalhe) {
      const dataDetalhe = String(detalhe.data_agendamento || data).slice(0, 10);
      setReagendamento({ data: dataDetalhe, horario: String(detalhe.horario || '').slice(0, 5), horarios: [], carregando: false, salvando: false });
      carregarHorariosReagendamento(dataDetalhe, detalhe);
    }
  }, [detalhe]);

  useEffect(() => {
    if (!detalhe) return undefined;

    detalheFecharRef.current?.focus();

    return () => {
      detalheBotaoAnteriorRef.current?.focus?.();
      detalheBotaoAnteriorRef.current = null;
    };
  }, [detalhe?.id]);

  useModalScrollLock(Boolean(detalhe));

  useEffect(() => {
    setHeaderNav(
      <div className="admin-nav">
        <span>{nomeAdmin}</span>
        <Link className="botao secundario botao-topo" to="/admin/alterar-senha">Senha</Link>
        <button type="button" className="secundario botao-topo" disabled={saindo} onClick={sair}>
          {saindo ? 'Saindo...' : 'Sair'}
        </button>
      </div>
    );

    return () => setHeaderNav(null);
  }, [nomeAdmin, saindo]);

  async function verificarSessao() {
    try {
      const dados = await apiJson('/api/admin/sessao');
      const usuarioAdmin = dados.role === 'ADMIN';
      setNomeAdmin(dados.nome);
      setPodeGerenciarUsuarios(usuarioAdmin);
      setCanManageUsers?.(usuarioAdmin);
      if (!usuarioAdmin && (abaAtiva === 'usuarios' || abaAtiva === 'logs')) {
        setAbaAtiva('agenda');
      }
      setVerificado(true); // libera renderização do conteúdo
    } catch (err) {
      navigate('/admin/login');
      return;
    }
    // Carrega dados após confirmar sessão — erros aqui mostram mensagem, não redirecionam
    carregarOpcoes();
  }

  async function carregarOpcoes() {
    try {
      const dados = await apiJson('/api/agendamentos/opcoes');
      setOpcoesUbs(dados.ubs || []);
      setOpcoesMedicamento(dados.tiposMedicamento || []);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar filtros.');
    }
  }

  async function carregarAgenda(evento, sobrescritas = {}) {
    if (evento) evento.preventDefault();
    setErro('');
    const filtroData = sobrescritas.data ?? data;
    const filtroUbs = sobrescritas.ubs ?? ubs;
    const filtroMedicamento = sobrescritas.medicamento ?? medicamento;
    const filtroStatus = sobrescritas.status ?? statusFiltro;
    const filtroBusca = sobrescritas.busca ?? buscaAgenda;
    const buscaNormalizada = filtroBusca.trim();
    if (!filtroData) return;

    if (buscaNormalizada.length === 1) {
      setAgendamentos([]);
      setResumo('Digite pelo menos 2 caracteres para buscar paciente em todos os agendamentos.');
      return;
    }

    const params = new URLSearchParams({ data: filtroData });
    if (filtroUbs) params.set('ubs', filtroUbs);
    if (filtroMedicamento) params.set('tipo_medicamento', filtroMedicamento);
    if (filtroStatus) params.set('status', filtroStatus);
    if (buscaNormalizada) params.set('busca', buscaNormalizada);

    const requestId = agendaRequestRef.current + 1;
    agendaRequestRef.current = requestId;
    setCarregando(true);
    setResumo('Carregando agenda...');
    setAgendamentos([]);

    try {
      const dados = await apiJson(`/api/admin/agendamentos?${params.toString()}`);
      if (requestId !== agendaRequestRef.current) return;
      const lista = dados.agendamentos || [];
      setAgendamentos(lista);
      if (!sobrescritas.manterPagina) {
        setPaginaAgenda(1);
      }
      setResumo(criarResumo(lista));
    } catch (err) {
      if (requestId !== agendaRequestRef.current) return;
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      setResumo('');
      setErro(err.message || 'Erro ao carregar agenda.');
    } finally {
      if (requestId === agendaRequestRef.current) setCarregando(false);
    }
  }

  function assinaturaAgendamento(ag) {
    return [ag.status, ag.horario, ag.data_agendamento, ag.presente_em, ag.atendido_em, ag.updated_at].join('|');
  }

  function aplicarAtualizacaoSilenciosa(novaLista) {
    const atual = agendamentosRef.current;
    const mapaAtual = new Map(atual.map((ag) => [ag.id, ag]));
    const idsMudados = [];
    let mudou = atual.length !== novaLista.length;

    novaLista.forEach((novo) => {
      const anterior = mapaAtual.get(novo.id);
      if (!anterior || assinaturaAgendamento(anterior) !== assinaturaAgendamento(novo)) {
        mudou = true;
        idsMudados.push(novo.id);
      }
    });

    if (!mudou) return; // nada mudou: nenhum re-render, nenhuma piscada

    setAgendamentos(novaLista);
    setResumo(criarResumo(novaLista, filtrosRef.current.busca));

    if (idsMudados.length > 0) {
      setIdsAtualizados(new Set(idsMudados));
      if (destaqueTimeoutRef.current) clearTimeout(destaqueTimeoutRef.current);
      destaqueTimeoutRef.current = setTimeout(() => setIdsAtualizados(new Set()), DURACAO_DESTAQUE_MS);
    }

    const totalPaginas = Math.max(1, Math.ceil(novaLista.length / ITENS_POR_PAGINA));
    setPaginaAgenda((paginaAtual) => Math.min(paginaAtual, totalPaginas));
  }

  async function atualizarAgendaSilenciosa() {
    const filtros = filtrosRef.current;
    if (!filtros.data) return;
    const buscaNormalizada = filtros.busca.trim();
    if (buscaNormalizada.length === 1) return;

    const params = new URLSearchParams({ data: filtros.data });
    if (filtros.ubs) params.set('ubs', filtros.ubs);
    if (filtros.medicamento) params.set('tipo_medicamento', filtros.medicamento);
    if (filtros.status) params.set('status', filtros.status);
    if (buscaNormalizada) params.set('busca', buscaNormalizada);

    atualizacaoSilenciosaEmVooRef.current = true;
    try {
      const dados = await apiJson(`/api/admin/agendamentos?${params.toString()}`);
      aplicarAtualizacaoSilenciosa(dados.agendamentos || []);
    } catch (err) {
      if (err.status === 401) navigate('/admin/login');
      // Outros erros no polling silencioso são ignorados de propósito: não interrompe o operador,
      // a próxima tentativa (em INTERVALO_ATUALIZACAO_MS) resolve sozinha se a rede voltar.
    } finally {
      atualizacaoSilenciosaEmVooRef.current = false;
    }
  }

  function confirmarAcao(config) {
    setConfirmacao(config);
  }

  function fecharConfirmacao() {
    setConfirmacao(null);
  }

  async function mudarStatus(id, status, confirmado = false) {
    if (!confirmado) {
      const rotulo = ROTULOS_STATUS[status] || status;
      confirmarAcao({
        title: `${rotulo} agendamento?`,
        message: `Confirme para alterar o status deste agendamento para "${rotulo}".`,
        confirmText: rotulo,
        danger: status === 'cancelado',
        onConfirm: () => mudarStatus(id, status, true)
      });
      return;
    }

    fecharConfirmacao();
    setErro('');
    try {
      await apiJson(`/api/admin/agendamentos/${id}`, jsonOptions({ status }, 'PATCH'));
      if (detalhe?.id === id) {
        setDetalhe((atual) => ({ ...atual, status }));
      }
      await carregarAgenda(null, { manterPagina: true });
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      setErro(err.message || 'Erro ao atualizar agendamento.');
    }
  }

  async function sair() {
    setSaindo(true);
    try {
      await apiJson('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      // Mesmo se o logout falhar, voltar para o login evita deixar a sessao exposta no navegador.
    } finally {
      navigate('/admin/login');
    }
  }

  function limparFiltros() {
    const dataHoje = hojeISO();
    setData(dataHoje);
    setUbs('');
    setMedicamento('');
    setStatusFiltro('');
    setBuscaAgenda('');
  }

  function exportarXLS() {
    const params = new URLSearchParams();
    if (data && !buscaAgenda.trim()) params.set('data', data);
    if (ubs) params.set('ubs', ubs);
    if (medicamento) params.set('tipo_medicamento', medicamento);
    if (statusFiltro) params.set('status', statusFiltro);
    if (buscaAgenda.trim()) params.set('busca', buscaAgenda);

    window.location.href = `/api/admin/agendamentos/exportar?${params.toString()}`;
  }

  async function carregarHorariosReagendamento(dataSelecionada, agendamento = detalhe) {
    if (!agendamento || !dataSelecionada) return;

    setReagendamento((atual) => ({ ...atual, data: dataSelecionada, carregando: true, horarios: [] }));
    try {
      const params = new URLSearchParams({
        data: dataSelecionada,
        primeiroAtendimento: String(Boolean(agendamento.primeiro_atendimento)),
        agendamentoId: String(agendamento.id)
      });
      const dados = await apiJson(`/api/admin/horarios-disponiveis?${params.toString()}`);
      setReagendamento((atual) => ({ ...atual, horarios: dados.blocos || [], carregando: false }));
    } catch (err) {
      setReagendamento((atual) => ({ ...atual, carregando: false }));
      setErro(err.message || 'Erro ao carregar horários para reagendamento.');
    }
  }

  async function salvarReagendamento(evento) {
    evento.preventDefault();
    if (!detalhe || !reagendamento.data || !reagendamento.horario) return;

    setErro('');
    setReagendamento((atual) => ({ ...atual, salvando: true }));
    try {
      await apiJson(`/api/admin/agendamentos/${detalhe.id}/reagendar`, jsonOptions({
        data_agendamento: reagendamento.data,
        horario: reagendamento.horario
      }, 'PATCH'));
      setDetalhe((atual) => ({ ...atual, data_agendamento: reagendamento.data, horario: reagendamento.horario }));
      await carregarAgenda(null, { manterPagina: true });
      await carregarBloqueios(data);
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      setErro(err.message || 'Erro ao reagendar.');
    } finally {
      setReagendamento((atual) => ({ ...atual, salvando: false }));
    }
  }

  async function carregarHorariosBloqueio(dataSelecionada) {
    try {
      const params = new URLSearchParams({ data: dataSelecionada, primeiroAtendimento: 'false' });
      const dados = await apiJson(`/api/admin/horarios-disponiveis?${params.toString()}`);
      setHorariosBloqueio(dados.blocos || []);
    } catch (err) {
      setHorariosBloqueio([]);
    }
  }

  async function carregarBloqueios(dataSelecionada) {
    try {
      const params = new URLSearchParams({ data: dataSelecionada });
      const dados = await apiJson(`/api/admin/bloqueios?${params.toString()}`);
      setBloqueios(dados.bloqueios || []);
    } catch (err) {
      setBloqueios([]);
    }
  }

  async function bloquearHorario(evento, confirmado = false) {
    evento?.preventDefault();
    setErro('');
    if (!data || !novoBloqueio.horario) {
      setErro('Escolha um horário para bloquear.');
      return;
    }

    if (!confirmado) {
      confirmarAcao({
        title: 'Bloquear horário?',
        message: `O horário ${novoBloqueio.horario} ficará indisponível para novos agendamentos nesta data.`,
        confirmText: 'Bloquear horário',
        danger: true,
        onConfirm: () => bloquearHorario(null, true)
      });
      return;
    }

    fecharConfirmacao();
    try {
      await apiJson('/api/admin/bloqueios', jsonOptions({
        data_agendamento: data,
        horario: novoBloqueio.horario,
        motivo: novoBloqueio.motivo
      }));
      setNovoBloqueio({ horario: '', motivo: '' });
      await carregarHorariosBloqueio(data);
      await carregarBloqueios(data);
      await carregarAgenda(null, { manterPagina: true });
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      setErro(err.message || 'Erro ao bloquear horário.');
    }
  }

  async function desbloquearHorario(id, confirmado = false) {
    if (!confirmado) {
      confirmarAcao({
        title: 'Desbloquear horário?',
        message: 'Este horário voltará a ficar disponível para novos agendamentos.',
        confirmText: 'Desbloquear',
        onConfirm: () => desbloquearHorario(id, true)
      });
      return;
    }

    fecharConfirmacao();
    setErro('');
    try {
      await apiJson(`/api/admin/bloqueios/${id}`, { method: 'DELETE' });
      await carregarHorariosBloqueio(data);
      await carregarBloqueios(data);
      await carregarAgenda(null, { manterPagina: true });
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      setErro(err.message || 'Erro ao desbloquear horário.');
    }
  }

  function abrirDetalhe(agendamento) {
    detalheBotaoAnteriorRef.current = document.activeElement;
    setDetalhe(agendamento);
  }

  function fecharDetalhe() {
    setDetalhe(null);
  }

  function navegarNoModal(evento) {
    if (evento.key === 'Escape') {
      evento.preventDefault();
      fecharDetalhe();
      return;
    }

    if (evento.key !== 'Tab') return;

    const focoPermitido = detalheModalRef.current?.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (!focoPermitido?.length) {
      evento.preventDefault();
      detalheModalRef.current?.focus();
      return;
    }

    const primeiro = focoPermitido[0];
    const ultimo = focoPermitido[focoPermitido.length - 1];

    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  function criarResumo(lista, buscaTexto = buscaAgenda) {
    const totalVagas = lista
      .filter((a) => a.status !== 'cancelado')
      .reduce((soma, a) => soma + a.vagas_ocupadas, 0);
    const totalAtb = lista.filter((a) => a.tipo_medicamento === 'Antibiotico' && a.status !== 'cancelado').length;
    const sufixo = buscaTexto.trim() ? ' - busca global' : '';
    return `${lista.length} agendamento(s) - ${totalVagas} vaga(s) ocupada(s) - ${totalAtb} de Antibiotico${sufixo}`;
  }

  function alterarOrdenacao(coluna) {
    if (ordenacao.coluna === coluna) {
      setOrdenacao({ coluna, direcao: ordenacao.direcao === 'asc' ? 'desc' : 'asc' });
    } else {
      setOrdenacao({ coluna, direcao: 'asc' });
    }
  }

  function cabecalhoOrdenavel(label, colunaId) {
    const isAtiva = ordenacao.coluna === colunaId;
    return (
      <th 
        onClick={() => alterarOrdenacao(colunaId)} 
        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
        title={`Ordenar por ${label}`}
      >
        {label} <span style={{ fontSize: '0.8em', opacity: isAtiva ? 1 : 0.3, marginLeft: '4px' }}>
          {isAtiva ? (ordenacao.direcao === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </th>
    );
  }

  // Não renderiza o painel enquanto a sessão não foi verificada (evita flash antes do redirecionamento)
  if (!verificado) return null;

  const agendamentosOrdenados = [...agendamentos].sort((a, b) => {
    let valorA = a[ordenacao.coluna] || '';
    let valorB = b[ordenacao.coluna] || '';
    
    if (ordenacao.coluna === 'paciente') {
      valorA = a.nome_completo || '';
      valorB = b.nome_completo || '';
    } else if (ordenacao.coluna === 'data') {
      valorA = a.data_agendamento || '';
      valorB = b.data_agendamento || '';
    } else if (ordenacao.coluna === 'retirada') {
      valorA = a.tipo_medicamento || '';
      valorB = b.tipo_medicamento || '';
    } else if (ordenacao.coluna === 'horario') {
      valorA = (a.data_agendamento || '') + ' ' + (a.horario || '');
      valorB = (b.data_agendamento || '') + ' ' + (b.horario || '');
    }

    if (valorA < valorB) return ordenacao.direcao === 'asc' ? -1 : 1;
    if (valorA > valorB) return ordenacao.direcao === 'asc' ? 1 : -1;
    return 0;
  });
  const totalPaginasAgenda = Math.max(1, Math.ceil(agendamentosOrdenados.length / ITENS_POR_PAGINA));
  const inicioPaginaAgenda = (paginaAgenda - 1) * ITENS_POR_PAGINA;
  const agendamentosPagina = agendamentosOrdenados.slice(inicioPaginaAgenda, inicioPaginaAgenda + ITENS_POR_PAGINA);

  return (
    <main className="pagina-admin">
      <h1 className="sr-only">Painel administrativo</h1>
      <>
        <div className="abas-admin" role="tablist" aria-label="Seções do painel administrativo">
          <button
            id="tab-agenda"
            type="button"
            className={abaAtiva === 'agenda' ? 'ativa' : ''}
            role="tab"
            aria-selected={abaAtiva === 'agenda'}
            aria-controls="painel-agenda"
            onClick={() => setAbaAtiva('agenda')}
          >
            Agenda
          </button>
          <button
            id="tab-relatorios"
            type="button"
            className={abaAtiva === 'relatorios' ? 'ativa' : ''}
            role="tab"
            aria-selected={abaAtiva === 'relatorios'}
            aria-controls="painel-relatorios"
            onClick={() => setAbaAtiva('relatorios')}
          >
            Relatorios
          </button>
          {podeGerenciarUsuarios && (
            <>
          <button
            id="tab-usuarios"
            type="button"
            className={abaAtiva === 'usuarios' ? 'ativa' : ''}
            role="tab"
            aria-selected={abaAtiva === 'usuarios'}
            aria-controls="painel-usuarios"
            onClick={() => setAbaAtiva('usuarios')}
          >
            Gerenciar usuários
          </button>
          <button
            id="tab-logs"
            type="button"
            className={abaAtiva === 'logs' ? 'ativa' : ''}
            role="tab"
            aria-selected={abaAtiva === 'logs'}
            aria-controls="painel-logs"
            onClick={() => setAbaAtiva('logs')}
          >
            Logs
          </button>
            </>
          )}
        </div>
      </>

      {abaAtiva === 'usuarios' && podeGerenciarUsuarios ? (
        <section id="painel-usuarios" role="tabpanel" aria-labelledby="tab-usuarios">
          <AdminCreateUserPage embedded />
        </section>
      ) : abaAtiva === 'logs' && podeGerenciarUsuarios ? (
        <section id="painel-logs" role="tabpanel" aria-labelledby="tab-logs">
          <AdminLogsPage />
        </section>
      ) : abaAtiva === 'relatorios' ? (
        <section id="painel-relatorios" role="tabpanel" aria-labelledby="tab-relatorios">
          <AdminReportsPage />
        </section>
      ) : (
        <section id="painel-agenda" role="tabpanel" aria-labelledby={podeGerenciarUsuarios ? 'tab-agenda' : undefined}>
      <div className="cartao">
        <h2>Agenda do dia</h2>
        <form className="filtros" onSubmit={carregarAgenda}>
          <CampoDataInput
            id="f-data"
            label="Data"
            valorIso={data}
            onChangeIso={(novaIso) => {
              if (novaIso) setData(novaIso);
            }}
          />
          <div className="campo">
            <label htmlFor="f-ubs">UBS</label>
            <select id="f-ubs" value={ubs} onChange={(e) => setUbs(e.target.value)}>
              <option value="">Todas</option>
              {opcoesUbs.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="f-medicamento">Medicamento</label>
            <select id="f-medicamento" value={medicamento} onChange={(e) => setMedicamento(e.target.value)}>
              <option value="">Todos</option>
              {opcoesMedicamento.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="f-status">Status</label>
            <select id="f-status" value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(ROTULOS_STATUS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="f-busca">Paciente</label>
            <input id="f-busca" value={buscaAgenda} placeholder="Nome, CPF ou telefone" onChange={(e) => setBuscaAgenda(e.target.value)} />
          </div>
          <div className="campo">
            <button type="submit" disabled={carregando}>{carregando ? 'Carregando...' : 'Atualizar'}</button>
          </div>
          <div className="campo">
            <button type="button" className="secundario" onClick={limparFiltros}>Limpar filtros</button>
          </div>
          <div className="campo">
            <button type="button" className="secundario" style={{ borderColor: '#217346', color: '#217346' }} onClick={exportarXLS}>Exportar Planilha</button>
          </div>
        </form>

        <div className="resumo-agenda">{resumo}</div>
        <Message>{erro}</Message>

        <div className="painel-admin-grid painel-admin-grid-unico">
          <section className="painel-admin-bloco">
            <h3>Bloqueio manual de horários</h3>
            <form className="bloqueio-form" onSubmit={bloquearHorario}>
              <select value={novoBloqueio.horario} onChange={(e) => setNovoBloqueio((atual) => ({ ...atual, horario: e.target.value }))}>
                <option value="">Horário</option>
                {horariosBloqueio.map((bloco) => (
                  <option key={bloco.horario} value={bloco.horario} disabled={!bloco.disponivel}>
                    {bloco.horario}{!bloco.disponivel ? ' indisponível' : ''}
                  </option>
                ))}
              </select>
              <input value={novoBloqueio.motivo} placeholder="Motivo" maxLength="255" onChange={(e) => setNovoBloqueio((atual) => ({ ...atual, motivo: e.target.value }))} />
              <button type="submit">Bloquear</button>
            </form>
            <div className="lista-bloqueios">
              {bloqueios.length === 0 ? (
                <span>Nenhum bloqueio nesta data.</span>
              ) : bloqueios.map((bloqueio) => (
                <div key={bloqueio.id} className="bloqueio-item">
                  <span><strong>{bloqueio.horario}</strong> {bloqueio.motivo || 'Sem motivo informado'}</span>
                  <button type="button" className="botao-tabela botao-faltou" onClick={() => desbloquearHorario(bloqueio.id)}>Desbloquear</button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="tabela-responsiva agenda-scroll">
          <table className="tabela-agenda">
            <thead>
              <tr>
                {cabecalhoOrdenavel('Data', 'data')}
                {cabecalhoOrdenavel('Horário', 'horario')}
                {cabecalhoOrdenavel('Paciente', 'paciente')}
                {cabecalhoOrdenavel('Origem', 'ubs')}
                {cabecalhoOrdenavel('Retirada', 'retirada')}
                {cabecalhoOrdenavel('Status', 'status')}
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                Array.from({ length: 5 }).map((_, indice) => (
                  <tr key={`carregando-${indice}`} className="linha-skeleton">
                    <td colSpan="7"><span /></td>
                  </tr>
                ))
              ) : agendamentosOrdenados.length === 0 ? (
                <tr>
                  <td colSpan="7">Nenhum agendamento encontrado para os filtros selecionados.</td>
                </tr>
              ) : agendamentosPagina.map((ag) => (
                <tr key={ag.id} className={idsAtualizados.has(ag.id) ? 'linha-atualizada' : undefined}>
                  <td className="coluna-data" data-label="Data">{dataBrasil(ag.data_agendamento)}</td>
                  <td className="coluna-horario" data-label="Horário">{String(ag.horario || '').slice(0, 5)}</td>
                  <td className="celula-principal" data-label="Paciente">
                    <strong>{ag.nome_completo}</strong>
                    <span>{formatarCpf(ag.cpf)} - {ag.telefone}</span>
                  </td>
                  <td className="celula-secundaria" data-label="Origem">{ag.ubs}</td>
                  <td className="celula-principal" data-label="Retirada">
                    <strong>{ag.tipo_medicamento}</strong>
                    <span>{ag.primeiro_atendimento ? 'Primeiro atendimento' : 'Retorno'}</span>
                  </td>
                  <td data-label="Status"><span className={`tag tag-${ag.status}`}>{ROTULOS_STATUS[ag.status] || ag.status}</span></td>
                  <td className="acoes-tabela" data-label="Ações">
                    <button type="button" className="botao-tabela botao-detalhes" onClick={() => abrirDetalhe(ag)}>
                      Detalhes
                    </button>
                    {(ag.status === 'confirmado' || ag.status === 'presente') && (
                      <div className="acoes-status" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                        {ag.status === 'confirmado' && (
                          <button type="button" className="botao-tabela botao-presente" style={{ backgroundColor: '#f59e0b', color: 'white', borderColor: '#d97706' }} onClick={() => mudarStatus(ag.id, 'presente')}>Presente</button>
                        )}
                        <button type="button" className="botao-tabela botao-atendido" onClick={() => mudarStatus(ag.id, 'atendido')}>Atendido</button>
                        <button type="button" className="botao-tabela botao-faltou" onClick={() => mudarStatus(ag.id, 'faltou')}>Faltou</button>
                        <button type="button" className="botao-tabela botao-cancelar" onClick={() => mudarStatus(ag.id, 'cancelado')}>Cancelar</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {agendamentosOrdenados.length > ITENS_POR_PAGINA && (
          <div className="paginacao">
            <button type="button" className="secundario" disabled={paginaAgenda === 1} onClick={() => setPaginaAgenda((p) => p - 1)}>Anterior</button>
            <span>Página {paginaAgenda} de {totalPaginasAgenda}</span>
            <button type="button" className="secundario" disabled={paginaAgenda === totalPaginasAgenda} onClick={() => setPaginaAgenda((p) => p + 1)}>Próxima</button>
          </div>
        )}
      </div>

      {detalhe && (
        <div className="modal-fundo" onClick={fecharDetalhe}>
          <div
            ref={detalheModalRef}
            className="modal-conteudo detalhes-agendamento"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-detalhes"
            tabIndex="-1"
            onClick={(evento) => evento.stopPropagation()}
            onKeyDown={navegarNoModal}
          >
            <div className="modal-cabecalho">
              <div>
                <h2 id="titulo-detalhes">Detalhes do agendamento</h2>
                <p>Protocolo #{detalhe.id}</p>
              </div>
              <button type="button" ref={detalheFecharRef} className="secundario" onClick={fecharDetalhe}>Fechar</button>
            </div>

            <div className="detalhes-secao">
              <h3>Retirada</h3>
              <dl className="detalhes-lista">
                <dt>Data</dt><dd>{dataBrasil(detalhe.data_agendamento)}</dd>
                <dt>Horário</dt><dd>{String(detalhe.horario || '').slice(0, 5)}</dd>
                <dt>Status</dt><dd><span className={`tag tag-${detalhe.status}`}>{ROTULOS_STATUS[detalhe.status] || detalhe.status}</span></dd>
                {detalhe.presente_em && (
                  <>
                    <dt>Recepcionado por</dt><dd>{detalhe.presente_por_nome || 'Desconhecido'}</dd>
                    <dt>Chegou em</dt><dd>{dataHoraBrasil(detalhe.presente_em)}</dd>
                  </>
                )}
                {detalhe.status === 'atendido' && detalhe.atendido_em && (
                  <>
                    <dt>Atendido por</dt><dd>{detalhe.atendido_por_nome || 'Desconhecido'}</dd>
                    <dt>Atendido em</dt><dd>{dataHoraBrasil(detalhe.atendido_em)}</dd>
                  </>
                )}
                <dt>Vagas ocupadas</dt><dd>{detalhe.vagas_ocupadas}</dd>
                <dt>Medicamento</dt><dd>{detalhe.tipo_medicamento}</dd>
                <dt>Previsão de término</dt><dd>{dataBrasil(detalhe.previsao_termino)}</dd>
                <dt>Primeiro atendimento</dt><dd>{detalhe.primeiro_atendimento ? 'Sim' : 'Não'}</dd>
              </dl>
            </div>

            <div className="detalhes-secao">
              <h3>Paciente</h3>
              <dl className="detalhes-lista">
                <dt>Nome</dt><dd>{detalhe.nome_completo}</dd>
                <dt>CPF</dt><dd>{formatarCpf(detalhe.cpf)}</dd>
                <dt>Nascimento</dt><dd>{dataBrasil(detalhe.data_nascimento)}</dd>
                <dt>Telefone</dt><dd>{detalhe.telefone}</dd>
                <dt>E-mail</dt><dd>{detalhe.email}</dd>
                <dt>UBS</dt><dd>{detalhe.ubs}</dd>
                <dt>Endereço</dt><dd>{detalhe.endereco}</dd>
              </dl>
            </div>

            <div className="detalhes-secao">
              <h3>Observações</h3>
              <p className="texto-observacoes">{detalhe.observacoes || 'Sem observações.'}</p>
            </div>

            <div className="detalhes-secao">
              <h3>Receita médica</h3>
              {detalhe.receita_arquivo ? (
                <div className="receita-anexo">
                  {/\.pdf$/i.test(detalhe.receita_arquivo) ? (
                    <iframe
                      className="receita-preview receita-preview-pdf"
                      src={`/api/admin/agendamentos/${detalhe.id}/receita`}
                      title="Receita médica anexada"
                    />
                  ) : (
                    <img
                      className="receita-preview"
                      src={`/api/admin/agendamentos/${detalhe.id}/receita`}
                      alt="Receita médica anexada"
                    />
                  )}
                  <a className="botao secundario" href={`/api/admin/agendamentos/${detalhe.id}/receita`} target="_blank" rel="noreferrer">
                    Abrir em nova aba
                  </a>
                </div>
              ) : (
                <p className="texto-observacoes">Nenhuma receita anexada.</p>
              )}
            </div>

            <form className="detalhes-secao reagendamento-form" onSubmit={salvarReagendamento}>
              <h3>Reagendamento</h3>
              <div className="grade">
                <CampoDataInput
                  id="r-data"
                  label="Nova data"
                  valorIso={reagendamento.data}
                  minIso={hojeISO()}
                  onChangeIso={(novaData) => {
                    setReagendamento((atual) => ({ ...atual, data: novaData, horario: '' }));
                    if (novaData) carregarHorariosReagendamento(novaData);
                  }}
                />
                <div className="campo">
                  <label htmlFor="r-horario">Novo horário</label>
                  <select id="r-horario" value={reagendamento.horario} disabled={reagendamento.carregando} onChange={(e) => setReagendamento((atual) => ({ ...atual, horario: e.target.value }))}>
                    <option value="">{reagendamento.carregando ? 'Carregando...' : 'Selecione...'}</option>
                    {reagendamento.horarios.map((bloco) => (
                      <option key={bloco.horario} value={bloco.horario} disabled={!bloco.disponivel}>
                        {bloco.horario}{!bloco.disponivel ? ' indisponível' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" disabled={reagendamento.salvando || !reagendamento.data || !reagendamento.horario}>
                {reagendamento.salvando ? 'Salvando...' : 'Salvar reagendamento'}
              </button>
            </form>

            <div className="detalhes-rodape">
              <span>Criado em {dataHoraBrasil(detalhe.created_at)}</span>
              {detalhe.status === 'confirmado' && (
                <div className="acoes">
                  <button type="button" onClick={() => mudarStatus(detalhe.id, 'atendido')}>Atendido</button>
                  <button type="button" onClick={() => mudarStatus(detalhe.id, 'faltou')}>Faltou</button>
                  <button type="button" onClick={() => mudarStatus(detalhe.id, 'cancelado')}>Cancelar</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </section>
      )}
      <ConfirmDialog open={Boolean(confirmacao)} onCancel={fecharConfirmacao} {...confirmacao} />
    </main>
  );
}
