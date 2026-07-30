import { useEffect, useMemo, useState } from 'react';
import { apiJson, jsonOptions } from '../api.js';
import { dataBrasil, hojeISO, ehFimDeSemana } from '../utils.js';
import Message from '../components/Message.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useNavigate } from 'react-router-dom';

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function primeiroDiaDoMes(anoMes) {
  return `${anoMes}-01`;
}

function ultimoDiaDoMes(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return `${anoMes}-${String(ultimoDia).padStart(2, '0')}`;
}

function anoMesAtual() {
  return hojeISO().slice(0, 7);
}

function adicionarMeses(anoMes, quantidade) {
  const [ano, mes] = anoMes.split('-').map(Number);
  const data = new Date(ano, mes - 1 + quantidade, 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
}

function nomeMes(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number);
  const data = new Date(ano, mes - 1, 1);
  const texto = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function gerarCelulasCalendario(anoMes) {
  const [ano, mes] = anoMes.split('-').map(Number);
  const primeiroDiaSemana = new Date(ano, mes - 1, 1).getDay();
  const totalDiasMes = new Date(ano, mes, 0).getDate();

  const celulas = [];
  for (let i = 0; i < primeiroDiaSemana; i++) {
    celulas.push(null);
  }
  for (let dia = 1; dia <= totalDiasMes; dia++) {
    celulas.push(`${anoMes}-${String(dia).padStart(2, '0')}`);
  }
  while (celulas.length % 7 !== 0) {
    celulas.push(null);
  }
  return celulas;
}

export default function AdminHorariosPage() {
  const navigate = useNavigate();
  const hoje = hojeISO();
  const [mesReferencia, setMesReferencia] = useState(anoMesAtual());
  const [diaSelecionado, setDiaSelecionado] = useState(hoje);
  const [diasBloqueadosMes, setDiasBloqueadosMes] = useState([]);
  const [resumoBloqueiosMes, setResumoBloqueiosMes] = useState([]);
  const [horariosDia, setHorariosDia] = useState([]);
  const [bloqueiosDia, setBloqueiosDia] = useState([]);
  const [carregandoMes, setCarregandoMes] = useState(false);
  const [carregandoDia, setCarregandoDia] = useState(false);
  const [motivoDiaInteiro, setMotivoDiaInteiro] = useState('');
  const [salvandoDiaInteiro, setSalvandoDiaInteiro] = useState(false);
  const [novoBloqueioHorario, setNovoBloqueioHorario] = useState({ horario: '', motivo: '' });
  const [salvandoHorario, setSalvandoHorario] = useState(false);
  const [erro, setErro] = useState('');
  const [confirmacao, setConfirmacao] = useState(null);

  useEffect(() => {
    carregarDadosMes(mesReferencia);
  }, [mesReferencia]);

  useEffect(() => {
    carregarDadosDia(diaSelecionado);
  }, [diaSelecionado]);

  const mapaDiasBloqueados = useMemo(() => {
    const mapa = new Map();
    diasBloqueadosMes.forEach((registro) => mapa.set(registro.data_agendamento, registro));
    return mapa;
  }, [diasBloqueadosMes]);

  const mapaResumoBloqueios = useMemo(() => {
    const mapa = new Map();
    resumoBloqueiosMes.forEach((registro) => mapa.set(registro.data, Number(registro.total)));
    return mapa;
  }, [resumoBloqueiosMes]);

  const diaInteiroBloqueado = mapaDiasBloqueados.get(diaSelecionado) || null;
  const diaEhFimDeSemana = ehFimDeSemana(diaSelecionado);
  const diaEhPassado = diaSelecionado < hoje;
  const diaGerenciavel = !diaEhFimDeSemana && !diaEhPassado;

  async function carregarDadosMes(anoMes) {
    setCarregandoMes(true);
    const dataInicio = primeiroDiaDoMes(anoMes);
    const dataFim = ultimoDiaDoMes(anoMes);
    try {
      const [diasResp, resumoResp] = await Promise.all([
        apiJson(`/api/admin/dias-bloqueados?data_inicio=${dataInicio}&data_fim=${dataFim}`),
        apiJson(`/api/admin/bloqueios/resumo-mes?data_inicio=${dataInicio}&data_fim=${dataFim}`)
      ]);
      setDiasBloqueadosMes(diasResp.diasBloqueados || []);
      setResumoBloqueiosMes(resumoResp.resumo || []);
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      setErro(err.message || 'Erro ao carregar o calendário.');
    } finally {
      setCarregandoMes(false);
    }
  }

  async function carregarDadosDia(dataSelecionada) {
    if (ehFimDeSemana(dataSelecionada)) {
      setHorariosDia([]);
      setBloqueiosDia([]);
      return;
    }

    setCarregandoDia(true);
    try {
      const params = new URLSearchParams({ data: dataSelecionada, primeiroAtendimento: 'false' });
      const [horariosResp, bloqueiosResp] = await Promise.all([
        apiJson(`/api/admin/horarios-disponiveis?${params.toString()}`),
        apiJson(`/api/admin/bloqueios?data=${dataSelecionada}`)
      ]);
      setHorariosDia(horariosResp.blocos || []);
      setBloqueiosDia(bloqueiosResp.bloqueios || []);
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      setHorariosDia([]);
      setBloqueiosDia([]);
    } finally {
      setCarregandoDia(false);
    }
  }

  function confirmarAcao(config) {
    setConfirmacao(config);
  }

  function fecharConfirmacao() {
    setConfirmacao(null);
  }

  async function bloquearDiaInteiro(evento, confirmado = false) {
    evento?.preventDefault();
    setErro('');

    if (!confirmado) {
      confirmarAcao({
        title: 'Bloquear o dia inteiro?',
        message: `Nenhum novo agendamento será permitido em ${dataBrasil(diaSelecionado)}. Isso só é possível se o dia ainda não tiver agendamentos.`,
        confirmText: 'Bloquear dia',
        danger: true,
        onConfirm: () => bloquearDiaInteiro(null, true)
      });
      return;
    }

    fecharConfirmacao();
    setSalvandoDiaInteiro(true);
    try {
      await apiJson('/api/admin/dias-bloqueados', jsonOptions({
        data_agendamento: diaSelecionado,
        motivo: motivoDiaInteiro
      }));
      setMotivoDiaInteiro('');
      await carregarDadosMes(mesReferencia);
      await carregarDadosDia(diaSelecionado);
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      setErro(err.message || 'Erro ao bloquear o dia.');
    } finally {
      setSalvandoDiaInteiro(false);
    }
  }

  async function desbloquearDiaInteiro(id, confirmado = false) {
    if (!confirmado) {
      confirmarAcao({
        title: 'Desbloquear o dia?',
        message: 'Este dia voltará a ficar disponível para novos agendamentos.',
        confirmText: 'Desbloquear',
        onConfirm: () => desbloquearDiaInteiro(id, true)
      });
      return;
    }

    fecharConfirmacao();
    setErro('');
    try {
      await apiJson(`/api/admin/dias-bloqueados/${id}`, { method: 'DELETE' });
      await carregarDadosMes(mesReferencia);
      await carregarDadosDia(diaSelecionado);
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      setErro(err.message || 'Erro ao desbloquear o dia.');
    }
  }

  async function bloquearHorario(evento, confirmado = false) {
    evento?.preventDefault();
    setErro('');
    if (!novoBloqueioHorario.horario) {
      setErro('Escolha um horário para bloquear.');
      return;
    }

    if (!confirmado) {
      confirmarAcao({
        title: 'Bloquear horário?',
        message: `O horário ${novoBloqueioHorario.horario} ficará indisponível para novos agendamentos em ${dataBrasil(diaSelecionado)}.`,
        confirmText: 'Bloquear horário',
        danger: true,
        onConfirm: () => bloquearHorario(null, true)
      });
      return;
    }

    fecharConfirmacao();
    setSalvandoHorario(true);
    try {
      await apiJson('/api/admin/bloqueios', jsonOptions({
        data_agendamento: diaSelecionado,
        horario: novoBloqueioHorario.horario,
        motivo: novoBloqueioHorario.motivo
      }));
      setNovoBloqueioHorario({ horario: '', motivo: '' });
      await carregarDadosMes(mesReferencia);
      await carregarDadosDia(diaSelecionado);
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      setErro(err.message || 'Erro ao bloquear horário.');
    } finally {
      setSalvandoHorario(false);
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
      await carregarDadosMes(mesReferencia);
      await carregarDadosDia(diaSelecionado);
    } catch (err) {
      if (err.status === 401) {
        navigate('/admin/login');
        return;
      }
      setErro(err.message || 'Erro ao desbloquear horário.');
    }
  }

  const celulas = gerarCelulasCalendario(mesReferencia);
  const horariosBloqueadosSet = new Set(bloqueiosDia.map((b) => b.horario));
  const horariosDisponiveisParaBloquear = horariosDia.filter((bloco) => bloco.disponivel);

  return (
    <div className="cartao">
      <h2>Horários</h2>
      <Message>{erro}</Message>

      <div className="painel-horarios-grid">
        <section className="painel-admin-bloco">
          <div className="calendario-cabecalho">
            <button type="button" className="secundario" onClick={() => setMesReferencia((m) => adicionarMeses(m, -1))} aria-label="Mês anterior">
              &lsaquo;
            </button>
            <strong>{nomeMes(mesReferencia)}</strong>
            <button type="button" className="secundario" onClick={() => setMesReferencia((m) => adicionarMeses(m, 1))} aria-label="Próximo mês">
              &rsaquo;
            </button>
          </div>

          <div className="calendario-legenda">
            <span><i className="legenda-cor legenda-disponivel" /> Disponível</span>
            <span><i className="legenda-cor legenda-parcial" /> Horários bloqueados</span>
            <span><i className="legenda-cor legenda-bloqueado" /> Dia bloqueado</span>
            <span><i className="legenda-cor legenda-indisponivel" /> Sem atendimento</span>
          </div>

          <div className="calendario-grade" role="grid" aria-label="Calendário de agendamentos">
            {DIAS_SEMANA.map((diaSemana) => (
              <div key={diaSemana} className="calendario-dia-semana">{diaSemana}</div>
            ))}
            {celulas.map((dataCelula, indice) => {
              if (!dataCelula) {
                return <div key={`vazio-${indice}`} className="calendario-celula calendario-celula-vazia" />;
              }

              const ehFds = ehFimDeSemana(dataCelula);
              const ehPassado = dataCelula < hoje;
              const ehHoje = dataCelula === hoje;
              const ehSelecionado = dataCelula === diaSelecionado;
              const bloqueadoInteiro = mapaDiasBloqueados.has(dataCelula);
              const totalBloqueiosParciais = mapaResumoBloqueios.get(dataCelula) || 0;

              let classeStatus = 'calendario-celula-disponivel';
              if (ehFds) classeStatus = 'calendario-celula-indisponivel';
              else if (bloqueadoInteiro) classeStatus = 'calendario-celula-bloqueado';
              else if (totalBloqueiosParciais > 0) classeStatus = 'calendario-celula-parcial';
              else if (ehPassado) classeStatus = 'calendario-celula-passado';

              return (
                <button
                  type="button"
                  key={dataCelula}
                  className={[
                    'calendario-celula',
                    classeStatus,
                    ehSelecionado ? 'calendario-celula-selecionada' : '',
                    ehHoje ? 'calendario-celula-hoje' : ''
                  ].filter(Boolean).join(' ')}
                  onClick={() => setDiaSelecionado(dataCelula)}
                  aria-pressed={ehSelecionado}
                  aria-label={`${dataBrasil(dataCelula)}${bloqueadoInteiro ? ' - dia bloqueado' : ''}`}
                >
                  {Number(dataCelula.slice(8, 10))}
                </button>
              );
            })}
          </div>
          {carregandoMes && <p className="texto-observacoes">Carregando calendário...</p>}
        </section>

        <section className="painel-admin-bloco">
          <h3>{dataBrasil(diaSelecionado)}</h3>

          {diaEhFimDeSemana ? (
            <p className="texto-observacoes">A farmácia não atende aos finais de semana.</p>
          ) : (
            <>
              <div className="painel-horarios-subsecao">
                <h4>Dia inteiro</h4>
                {diaInteiroBloqueado ? (
                  <div className="bloqueio-item">
                    <span>
                      <strong>Dia bloqueado</strong> {diaInteiroBloqueado.motivo || 'Sem motivo informado'}
                    </span>
                    <button type="button" className="botao-tabela botao-faltou" onClick={() => desbloquearDiaInteiro(diaInteiroBloqueado.id)}>
                      Desbloquear dia
                    </button>
                  </div>
                ) : (
                  <form className="bloqueio-form" onSubmit={bloquearDiaInteiro}>
                    <input
                      value={motivoDiaInteiro}
                      placeholder="Motivo (opcional)"
                      maxLength="255"
                      disabled={!diaGerenciavel}
                      onChange={(e) => setMotivoDiaInteiro(e.target.value)}
                    />
                    <button type="submit" disabled={!diaGerenciavel || salvandoDiaInteiro}>
                      {salvandoDiaInteiro ? 'Bloqueando...' : 'Bloquear dia inteiro'}
                    </button>
                  </form>
                )}
                {diaEhPassado && !diaInteiroBloqueado && (
                  <p className="texto-observacoes">Não é possível bloquear uma data que já passou.</p>
                )}
              </div>

              <div className="painel-horarios-subsecao">
                <h4>Horários do dia</h4>
                {carregandoDia ? (
                  <p className="texto-observacoes">Carregando horários...</p>
                ) : (
                  <div className="grade-horarios-dia">
                    {horariosDia.map((bloco) => {
                      const bloqueio = bloqueiosDia.find((b) => b.horario === bloco.horario);
                      const status = bloqueio ? 'bloqueado' : bloco.disponivel ? 'disponivel' : 'ocupado';
                      return (
                        <span
                          key={bloco.horario}
                          className={`chip-horario chip-horario-${status}`}
                          title={bloqueio ? (bloqueio.motivo || 'Bloqueado') : status === 'ocupado' ? 'Ocupado por agendamento' : 'Disponível'}
                        >
                          {bloco.horario}
                        </span>
                      );
                    })}
                    {horariosDia.length === 0 && !carregandoDia && (
                      <span>Nenhum horário configurado para este dia.</span>
                    )}
                  </div>
                )}

                {diaGerenciavel && (
                  <form className="bloqueio-form" onSubmit={bloquearHorario}>
                    <select
                      value={novoBloqueioHorario.horario}
                      onChange={(e) => setNovoBloqueioHorario((atual) => ({ ...atual, horario: e.target.value }))}
                    >
                      <option value="">Horário</option>
                      {horariosDisponiveisParaBloquear.map((bloco) => (
                        <option key={bloco.horario} value={bloco.horario}>{bloco.horario}</option>
                      ))}
                    </select>
                    <input
                      value={novoBloqueioHorario.motivo}
                      placeholder="Motivo"
                      maxLength="255"
                      onChange={(e) => setNovoBloqueioHorario((atual) => ({ ...atual, motivo: e.target.value }))}
                    />
                    <button type="submit" disabled={salvandoHorario}>
                      {salvandoHorario ? 'Bloqueando...' : 'Bloquear horário'}
                    </button>
                  </form>
                )}

                <div className="lista-bloqueios">
                  {bloqueiosDia.length === 0 ? (
                    <span>Nenhum horário bloqueado nesta data.</span>
                  ) : bloqueiosDia.map((bloqueio) => (
                    <div key={bloqueio.id} className="bloqueio-item">
                      <span><strong>{bloqueio.horario}</strong> {bloqueio.motivo || 'Sem motivo informado'}</span>
                      <button type="button" className="botao-tabela botao-faltou" onClick={() => desbloquearHorario(bloqueio.id)}>
                        Desbloquear
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>

      <ConfirmDialog open={Boolean(confirmacao)} onCancel={fecharConfirmacao} {...confirmacao} />
    </div>
  );
}
