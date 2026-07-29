import { useEffect, useRef, useState } from 'react';
import { apiJson, formDataOptions } from '../api.js';
import {
  aplicarMascaraCpf,
  aplicarMascaraData,
  aplicarMascaraTelefone,
  cpfValido,
  dataBrParaIso,
  dataIsoParaBr,
  ehFimDeSemana,
  emailValido,
  amanhaISO,
  hojeISO,
  somenteDigitos,
  telefoneValido
} from '../utils.js';
import Message from '../components/Message.jsx';
import CampoDataInput from '../components/CampoDataInput.jsx';
import { useNavigate } from 'react-router-dom';

const hoje = hojeISO();
const amanha = amanhaISO();
const estadoInicial = {
  cpf: '',
  nome_completo: '',
  data_nascimento: '',
  endereco: '',
  telefone: '',
  email: '',
  ubs: '',
  tipo_medicamento: '',
  previsao_termino: '',
  primeiro_atendimento: '',
  observacoes: '',
  data_agendamento: ''
};

const mensagensObrigatorias = {
  cpf: 'Informe o CPF do paciente.',
  nome_completo: 'Informe o nome completo do paciente.',
  data_nascimento: 'Informe a data de nascimento.',
  endereco: 'Informe o endereco residencial.',
  telefone: 'Informe o telefone para contato.',
  email: 'Informe o e-mail para confirmacao.',
  ubs: 'Selecione a UBS de referencia.',
  tipo_medicamento: 'Selecione o tipo de medicamento.',
  previsao_termino: 'Informe a previsao de termino da medicacao.',
  data_agendamento: 'Informe a data da retirada.',
  primeiro_atendimento: 'Informe se e o primeiro atendimento.'
};

const TOTAL_ETAPAS = 4;
const ETAPAS_ROTULOS = ['Data e horário', 'Identificação', 'Contato', 'Medicação'];
const CAMPOS_POR_ETAPA = {
  1: ['data_agendamento', 'primeiro_atendimento'],
  2: ['cpf', 'nome_completo', 'data_nascimento'],
  3: ['endereco', 'telefone', 'email'],
  4: ['ubs', 'tipo_medicamento', 'previsao_termino']
};

const TIPOS_RECEITA_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const TAMANHO_MAXIMO_RECEITA = 5 * 1024 * 1024;

function CampoData({ id, label, obrigatorio, valorIso, ajudaTexto, ajudaId, erroId, mensagemErro, onBlur, onChangeIso, larguraTotal = true, apenasIcone = false }) {
  return (
    <CampoDataInput
      id={id}
      label={label}
      obrigatorio={obrigatorio}
      valorIso={valorIso}
      onChangeIso={onChangeIso}
      ajudaTexto={ajudaTexto}
      ajudaId={ajudaId}
      erroId={erroId}
      mensagemErro={mensagemErro}
      onBlur={onBlur}
      larguraTotal={larguraTotal}
      apenasIcone={apenasIcone}
    />
  );
}

export default function SchedulingPage() {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const erroRef = useRef(null);
  const primeiraRenderizacaoRef = useRef(true);
  const [form, setForm] = useState(estadoInicial);
  const [ubs, setUbs] = useState([]);
  const [tiposMedicamento, setTiposMedicamento] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [horarioAtual, setHorarioAtual] = useState('');
  const [erro, setErro] = useState('');
  const [avisoPaciente, setAvisoPaciente] = useState(null);
  const [avisoHorarios, setAvisoHorarios] = useState(null);
  const [carregandoOpcoes, setCarregandoOpcoes] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [tocados, setTocados] = useState({});
  const [etapa, setEtapa] = useState(1);
  const [receita, setReceita] = useState(null);
  const [erroReceita, setErroReceita] = useState('');
  const cpfBuscadoRef = useRef('');
  const cpfAtualRef = useRef('');

  useEffect(() => {
    async function carregarOpcoes() {
      setCarregandoOpcoes(true);
      try {
        const dados = await apiJson('/api/agendamentos/opcoes');
        setUbs(dados.ubs || []);
        setTiposMedicamento(dados.tiposMedicamento || []);
      } catch (err) {
        mostrarErro(err.message || 'Não foi possível carregar as opções do formulário.');
      } finally {
        setCarregandoOpcoes(false);
      }
    }

    carregarOpcoes();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(buscarPacientePorCpf, 350);
    return () => clearTimeout(timeout);
  }, [form.cpf]);

  useEffect(() => {
    carregarHorarios();
  }, [form.data_agendamento, form.primeiro_atendimento]);

  useEffect(() => {
    if (primeiraRenderizacaoRef.current) {
      primeiraRenderizacaoRef.current = false;
      return;
    }
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [etapa]);

  function atualizar(campo, valor) {
    if (campo === 'cpf') cpfAtualRef.current = valor;
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }

  function marcarTocado(campo) {
    setTocados((atual) => ({ ...atual, [campo]: true }));
  }

  function erroCampo(campo) {
    if (mensagensObrigatorias[campo] && !String(form[campo] || '').trim()) return mensagensObrigatorias[campo];
    if (campo === 'cpf' && form.cpf && !cpfValido(form.cpf)) return 'CPF invalido. Confira os numeros digitados.';
    if (campo === 'telefone' && form.telefone && !telefoneValido(form.telefone)) return 'Informe um telefone com DDD.';
    if (campo === 'email' && form.email && !emailValido(form.email)) return 'Informe um e-mail valido.';
    if (campo === 'data_nascimento' && form.data_nascimento > hoje) return 'A data de nascimento nao pode ser futura.';
    if (campo === 'previsao_termino' && form.previsao_termino < hoje) return 'A previsao de termino nao pode estar no passado.';
    if (campo === 'data_agendamento' && form.data_agendamento < amanha) return 'Escolha uma data a partir do dia seguinte.';
    if (campo === 'data_agendamento' && ehFimDeSemana(form.data_agendamento)) return 'A farmacia atende apenas de segunda a sexta.';
    if (campo === 'primeiro_atendimento' && !form.primeiro_atendimento) return 'Informe se e o primeiro atendimento para liberar os horarios.';
    return '';
  }

  function mensagemCampo(campo) {
    return tocados[campo] ? erroCampo(campo) : '';
  }

  function classeCampo(campo) {
    if (!tocados[campo]) return '';
    if (erroCampo(campo)) return 'campo-invalido';
    if (campo === 'cpf' && cpfValido(form.cpf)) return 'campo-valido';
    return '';
  }

  function mostrarErro(texto) {
    setErro(texto);
    setTimeout(() => erroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
  }

  function etapaCompleta(numeroEtapa) {
    const campos = CAMPOS_POR_ETAPA[numeroEtapa];
    if (campos.some((campo) => erroCampo(campo))) return false;
    if (numeroEtapa === 1 && !horarioAtual) return false;
    return true;
  }

  function avancar() {
    const campos = CAMPOS_POR_ETAPA[etapa];
    setTocados((atual) => {
      const atualizados = { ...atual };
      campos.forEach((campo) => { atualizados[campo] = true; });
      return atualizados;
    });

    if (!etapaCompleta(etapa)) {
      mostrarErro('Preencha corretamente os campos desta etapa para continuar.');
      return;
    }

    setErro('');
    setEtapa((atual) => Math.min(atual + 1, TOTAL_ETAPAS));
  }

  function voltar() {
    setErro('');
    setEtapa((atual) => Math.max(atual - 1, 1));
  }

  function selecionarReceita(evento) {
    const arquivo = evento.target.files[0];
    if (!arquivo) {
      setReceita(null);
      setErroReceita('');
      return;
    }

    if (!TIPOS_RECEITA_ACEITOS.includes(arquivo.type)) {
      setErroReceita('Envie a receita em formato JPG, PNG ou PDF.');
      setReceita(null);
      evento.target.value = '';
      return;
    }

    if (arquivo.size > TAMANHO_MAXIMO_RECEITA) {
      setErroReceita('O arquivo deve ter no máximo 5 MB.');
      setReceita(null);
      evento.target.value = '';
      return;
    }

    setErroReceita('');
    setReceita(arquivo);
  }

  function preencherPaciente(paciente) {
    setForm((atual) => ({
      ...atual,
      nome_completo: paciente.nome_completo || '',
      data_nascimento: paciente.data_nascimento || '',
      endereco: paciente.endereco || '',
      telefone: aplicarMascaraTelefone(paciente.telefone || ''),
      email: paciente.email || '',
      ubs: paciente.ubs || atual.ubs
    }));
  }

  async function buscarPacientePorCpf() {
    const cpf = somenteDigitos(form.cpf);
    setAvisoPaciente(null);

    if (cpf.length < 11) {
      cpfBuscadoRef.current = '';
      return;
    }

    if (!cpfValido(cpf)) {
      setAvisoPaciente({ tipo: 'erro', texto: 'CPF inválido. Confira os números digitados.' });
      return;
    }

    if (cpf === cpfBuscadoRef.current) return;
    cpfBuscadoRef.current = cpf;

    try {
      const dados = await apiJson(`/api/agendamentos/paciente/${cpf}`);
      if (somenteDigitos(cpfAtualRef.current) !== cpf) return;

      if (dados.encontrado && dados.paciente) {
        preencherPaciente(dados.paciente);
        setAvisoPaciente({ tipo: 'sucesso', texto: 'Cadastro encontrado. Dados preenchidos automaticamente.' });
      }
    } catch (err) {
      if (somenteDigitos(cpfAtualRef.current) !== cpf) return;

      if (err.status === 404) {
        setAvisoPaciente({ tipo: 'sucesso', texto: 'CPF ainda não cadastrado. Complete os dados para criar o cadastro.' });
        return;
      }
      setAvisoPaciente({ tipo: 'erro', texto: err.message || 'Não foi possível buscar o cadastro pelo CPF.' });
    }
  }

  function resetarHorario() {
    setHorarioAtual('');
    setHorarios([]);
  }

  async function carregarHorarios() {
    resetarHorario();
    setAvisoHorarios(null);

    if (!form.data_agendamento) return;

    if (form.data_agendamento < amanha) {
      setAvisoHorarios({ tipo: 'erro', texto: 'Agendamentos devem ser feitos a partir do dia seguinte.' });
      return;
    }

    if (ehFimDeSemana(form.data_agendamento)) {
      setAvisoHorarios({ tipo: 'erro', texto: 'A farmácia não atende aos fins de semana. Escolha um dia útil.' });
      return;
    }

    if (!form.primeiro_atendimento) {
      setAvisoHorarios({ tipo: 'erro', texto: 'Informe se é o seu primeiro atendimento para ver os horários disponíveis.' });
      return;
    }

    setAvisoHorarios({ tipo: 'sucesso', texto: 'Carregando horários...' });

    try {
      const params = new URLSearchParams({
        data: form.data_agendamento,
        primeiroAtendimento: String(form.primeiro_atendimento === 'sim')
      });
      const dados = await apiJson(`/api/agendamentos/horarios-disponiveis?${params.toString()}`);

      if (!dados.blocos || dados.blocos.length === 0) {
        setAvisoHorarios({ tipo: 'erro', texto: 'Nenhum horário disponível para esta data.' });
        return;
      }

      setAvisoHorarios(null);
      setHorarios(dados.blocos);
    } catch (err) {
      setAvisoHorarios({ tipo: 'erro', texto: err.message || 'Não foi possível carregar os horários.' });
    }
  }

  function validarFormularioAntesDoEnvio() {
    const camposParaValidar = Object.keys(mensagensObrigatorias);
    for (const campo of camposParaValidar) {
      const erro = erroCampo(campo);
      if (erro) {
        mostrarErro(erro);
        return false;
      }
    }
    if (!horarioAtual) {
      mostrarErro('Selecione um horário disponível.');
      return false;
    }
    return true;
  }

  async function enviar(evento) {
    evento.preventDefault();

    if (etapa !== TOTAL_ETAPAS) {
      avancar();
      return;
    }

    setErro('');
    setTocados({
      cpf: true,
      telefone: true,
      email: true,
      nome_completo: true,
      data_nascimento: true,
      endereco: true,
      ubs: true,
      tipo_medicamento: true,
      previsao_termino: true,
      data_agendamento: true,
      primeiro_atendimento: true
    });

    if (!formRef.current.checkValidity()) {
      formRef.current.reportValidity();
      return;
    }
    if (!validarFormularioAntesDoEnvio()) return;

    const payload = {
      nome_completo: form.nome_completo.trim(),
      cpf: somenteDigitos(form.cpf),
      data_nascimento: form.data_nascimento,
      endereco: form.endereco.trim(),
      telefone: somenteDigitos(form.telefone),
      email: form.email.trim(),
      ubs: form.ubs,
      tipo_medicamento: form.tipo_medicamento,
      previsao_termino: form.previsao_termino,
      primeiro_atendimento: form.primeiro_atendimento,
      observacoes: form.observacoes.trim(),
      data_agendamento: form.data_agendamento,
      horario: horarioAtual,
      receita
    };

    setEnviando(true);
    try {
      const dados = await apiJson('/api/agendamentos', formDataOptions(payload));
      sessionStorage.setItem('ultimoAgendamento', JSON.stringify(dados));
      navigate('/confirmacao');
    } catch (err) {
      mostrarErro(err.message || 'Não foi possível concluir o agendamento.');
      if (err.codigo === 'HORARIO_LOTADO' || err.codigo === 'LIMITE_ATB') carregarHorarios();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="pagina-agendamento">
      <h1 className="sr-only">Agendar retirada de medicamento</h1>
      <form ref={formRef} className="fluxo-agendamento" noValidate onSubmit={enviar}>
        <ol className="passos-agendamento" aria-label="Etapas do agendamento">
          {ETAPAS_ROTULOS.map((rotulo, indice) => {
            const numero = indice + 1;
            const classe = numero < etapa ? 'concluido' : numero === etapa ? 'ativo' : '';
            return <li key={rotulo} className={classe}>{numero}. {rotulo}</li>;
          })}
        </ol>
        <p className="etapa-atual-mobile" aria-hidden="true">Etapa {etapa} de {TOTAL_ETAPAS} — {ETAPAS_ROTULOS[etapa - 1]}</p>

        <div ref={erroRef}><Message>{erro}</Message></div>

        {etapa === 1 && (
          <section className="cartao">
            <h2>1. Escolha a data e o horário</h2>
            <p className="texto-apoio">
              Primeiro confira a disponibilidade. Depois você preenche os dados pessoais para confirmar a retirada.
            </p>

            <div className="grade">
              <div className="campo largura-total">
                <label>Este é o seu primeiro atendimento para esta medicação? <span className="etiqueta-obrigatorio">Obrigatório</span></label>
                <div className="radio-grupo">
                  <label><input type="radio" name="primeiro_atendimento" value="sim" checked={form.primeiro_atendimento === 'sim'} required onChange={(e) => { marcarTocado('primeiro_atendimento'); atualizar('primeiro_atendimento', e.target.value); }} /> Sim</label>
                  <label><input type="radio" name="primeiro_atendimento" value="nao" checked={form.primeiro_atendimento === 'nao'} required onChange={(e) => { marcarTocado('primeiro_atendimento'); atualizar('primeiro_atendimento', e.target.value); }} /> Não</label>
                </div>
                <p className="campo-ajuda">Primeiro atendimento usa uma vaga maior para conferencia inicial da medicacao.</p>
                <p className="campo-erro-texto">{mensagemCampo('primeiro_atendimento')}</p>
              </div>

              <CampoData
                id="data_agendamento"
                label="Data para retirada (segunda a sexta)"
                obrigatorio
                valorIso={form.data_agendamento}
                ajudaTexto="Datas passadas, o dia atual e fins de semana ficam bloqueados para retirada."
                ajudaId="data-agendamento-ajuda"
                erroId="data-agendamento-erro"
                mensagemErro={mensagemCampo('data_agendamento')}
                onBlur={() => marcarTocado('data_agendamento')}
                onChangeIso={(valor) => atualizar('data_agendamento', valor)}
              />
            </div>

            <Message type={avisoHorarios?.tipo}>{avisoHorarios?.texto}</Message>
            <div className="grade-horarios" aria-label="Horários disponíveis">
              {horarios.map((bloco) => (
                <button
                  type="button"
                  key={bloco.horario}
                  className={`horario-btn${horarioAtual === bloco.horario ? ' selecionado' : ''}`}
                  disabled={!bloco.disponivel}
                  aria-pressed={horarioAtual === bloco.horario}
                  onClick={() => setHorarioAtual(bloco.horario)}
                >
                  {bloco.horario}
                </button>
              ))}
            </div>

            {!etapaCompleta(1) && (
              <p className="campo-ajuda aviso-submit">Selecione a data, o primeiro atendimento e um horário disponível para continuar.</p>
            )}

            <div className="acoes acoes-navegacao">
              <button type="button" id="btn-avancar-etapa1" disabled={!etapaCompleta(1)} onClick={avancar}>Avançar</button>
            </div>
          </section>
        )}

        {etapa === 2 && (
          <section className="cartao">
            <h2>2. Identificação do paciente</h2>

            <div className="campo">
              <label htmlFor="cpf">CPF do paciente <span className="etiqueta-obrigatorio">Obrigatório</span></label>
              <input id="cpf" className={classeCampo('cpf')} value={form.cpf} placeholder="000.000.000-00" maxLength="14" inputMode="numeric" autoComplete="off" required aria-invalid={Boolean(mensagemCampo('cpf'))} aria-describedby="cpf-ajuda cpf-erro" onBlur={() => marcarTocado('cpf')} onChange={(e) => atualizar('cpf', aplicarMascaraCpf(e.target.value))} />
              <p className="campo-ajuda" id="cpf-ajuda">Ao informar um CPF já cadastrado, os dados do paciente serão preenchidos automaticamente.</p>
              <p className="campo-erro-texto" id="cpf-erro">{mensagemCampo('cpf')}</p>
            </div>

            <Message type={avisoPaciente?.tipo}>{avisoPaciente?.texto}</Message>

            <div className="grade">
              <div className="campo largura-total">
                <label htmlFor="nome_completo">Nome completo do paciente <span className="etiqueta-obrigatorio">Obrigatório</span></label>
                <input id="nome_completo" className={classeCampo('nome_completo')} value={form.nome_completo} maxLength="150" autoComplete="name" required aria-invalid={Boolean(mensagemCampo('nome_completo'))} aria-describedby="nome-erro" onBlur={() => marcarTocado('nome_completo')} onChange={(e) => atualizar('nome_completo', e.target.value)} />
                <p className="campo-erro-texto" id="nome-erro">{mensagemCampo('nome_completo')}</p>
              </div>

              <CampoData
                id="data_nascimento"
                label="Data de nascimento"
                obrigatorio
                valorIso={form.data_nascimento}
                erroId="data-nascimento-erro"
                mensagemErro={mensagemCampo('data_nascimento')}
                onBlur={() => marcarTocado('data_nascimento')}
                onChangeIso={(valor) => atualizar('data_nascimento', valor)}
              />
            </div>

            {!etapaCompleta(2) && (
              <p className="campo-ajuda aviso-submit">Preencha CPF, nome completo e data de nascimento corretamente para continuar.</p>
            )}

            <div className="acoes acoes-navegacao">
              <button type="button" className="secundario" onClick={voltar}>Voltar</button>
              <button type="button" id="btn-avancar-etapa2" disabled={!etapaCompleta(2)} onClick={avancar}>Avançar</button>
            </div>
          </section>
        )}

        {etapa === 3 && (
          <section className="cartao">
            <h2>3. Contato e endereço</h2>
            <p className="texto-apoio">Usamos esses dados para confirmar o agendamento e falar com você, se preciso.</p>

            <div className="grade">
              <div className="campo largura-total">
                <label htmlFor="endereco">Endereço residencial <span className="etiqueta-obrigatorio">Obrigatório</span></label>
                <input id="endereco" className={classeCampo('endereco')} value={form.endereco} maxLength="255" autoComplete="street-address" required aria-invalid={Boolean(mensagemCampo('endereco'))} aria-describedby="endereco-erro" onBlur={() => marcarTocado('endereco')} onChange={(e) => atualizar('endereco', e.target.value)} />
                <p className="campo-erro-texto" id="endereco-erro">{mensagemCampo('endereco')}</p>
              </div>

              <div className="campo">
                <label htmlFor="telefone">Telefone para contato (WhatsApp) <span className="etiqueta-obrigatorio">Obrigatório</span></label>
                <input type="tel" id="telefone" className={classeCampo('telefone')} value={form.telefone} placeholder="(43) 90000-0000" maxLength="15" inputMode="tel" autoComplete="tel" required aria-invalid={Boolean(mensagemCampo('telefone'))} aria-describedby="telefone-erro" onBlur={() => marcarTocado('telefone')} onChange={(e) => atualizar('telefone', aplicarMascaraTelefone(e.target.value))} />
                <p className="campo-erro-texto" id="telefone-erro">{mensagemCampo('telefone')}</p>
              </div>

              <div className="campo">
                <label htmlFor="email">E-mail para confirmação <span className="etiqueta-obrigatorio">Obrigatório</span></label>
                <input type="email" id="email" className={classeCampo('email')} value={form.email} maxLength="150" autoComplete="email" required aria-invalid={Boolean(mensagemCampo('email'))} aria-describedby="email-erro" onBlur={() => marcarTocado('email')} onChange={(e) => atualizar('email', e.target.value)} />
                <p className="campo-erro-texto" id="email-erro">{mensagemCampo('email')}</p>
              </div>
            </div>

            {!etapaCompleta(3) && (
              <p className="campo-ajuda aviso-submit">Preencha endereço, telefone e e-mail corretamente para continuar.</p>
            )}

            <div className="acoes acoes-navegacao">
              <button type="button" className="secundario" onClick={voltar}>Voltar</button>
              <button type="button" id="btn-avancar-etapa3" disabled={!etapaCompleta(3)} onClick={avancar}>Avançar</button>
            </div>
          </section>
        )}

        {etapa === 4 && (
          <section className="cartao">
            <h2>4. Medicação e receita</h2>

            <div className="grade">
              <div className="campo largura-total">
                <label htmlFor="ubs">Unidade Básica de Saúde (UBS) de referência <span className="etiqueta-obrigatorio">Obrigatório</span></label>
                <select id="ubs" className={classeCampo('ubs')} value={form.ubs} disabled={carregandoOpcoes} required aria-invalid={Boolean(mensagemCampo('ubs'))} aria-describedby="ubs-erro" onBlur={() => marcarTocado('ubs')} onChange={(e) => atualizar('ubs', e.target.value)}>
                  <option value="">Selecione uma UBS</option>
                  {ubs.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <p className="campo-erro-texto" id="ubs-erro">{mensagemCampo('ubs')}</p>
              </div>

              <div className="campo">
                <label htmlFor="tipo_medicamento">Tipo de medicamento <span className="etiqueta-obrigatorio">Obrigatório</span></label>
                <select id="tipo_medicamento" className={classeCampo('tipo_medicamento')} value={form.tipo_medicamento} disabled={carregandoOpcoes} required aria-invalid={Boolean(mensagemCampo('tipo_medicamento'))} aria-describedby="tipo-medicamento-ajuda tipo-medicamento-erro" onBlur={() => marcarTocado('tipo_medicamento')} onChange={(e) => atualizar('tipo_medicamento', e.target.value)}>
                  <option value="">Selecione um medicamento</option>
                  {tiposMedicamento.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                <p className="campo-ajuda" id="tipo-medicamento-ajuda">Selecione o grupo da medicacao para organizar a disponibilidade da farmacia.</p>
                <p className="campo-erro-texto" id="tipo-medicamento-erro">{mensagemCampo('tipo_medicamento')}</p>
              </div>

              <CampoData
                id="previsao_termino"
                label="Data prevista para término da medicação"
                obrigatorio
                larguraTotal={false}
                valorIso={form.previsao_termino}
                ajudaTexto="Quando a sua receita atual acaba? Esta informação costuma estar na receita médica."
                ajudaId="previsao-ajuda"
                erroId="previsao-erro"
                mensagemErro={mensagemCampo('previsao_termino')}
                onBlur={() => marcarTocado('previsao_termino')}
                onChangeIso={(valor) => atualizar('previsao_termino', valor)}
              />

              <div className="campo largura-total">
                <label htmlFor="receita">Foto ou PDF da receita médica (opcional)</label>
                <input type="file" id="receita" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={selecionarReceita} />
                <p className="campo-ajuda">Envie uma foto legível ou um PDF da receita para agilizar a conferência no dia da retirada. Tamanho máximo: 5 MB.</p>
                {receita && <p className="campo-ajuda">Arquivo selecionado: {receita.name}</p>}
                {erroReceita && <p className="campo-erro-texto">{erroReceita}</p>}
              </div>

              <div className="campo largura-total">
                <label htmlFor="observacoes">Observações adicionais (opcional)</label>
                <textarea id="observacoes" value={form.observacoes} rows="4" maxLength="2000" onChange={(e) => atualizar('observacoes', e.target.value)} />
              </div>
            </div>

            {!etapaCompleta(4) && (
              <p className="campo-ajuda aviso-submit">Preencha UBS, tipo de medicamento e previsão de término para concluir.</p>
            )}

            <div className="acoes acoes-navegacao">
              <button type="button" className="secundario" onClick={voltar}>Voltar</button>
              <button type="submit" id="btn-confirmar-agendamento" disabled={!etapaCompleta(4) || !horarioAtual || enviando}>
                {enviando ? 'Enviando...' : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                      <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    Confirmar agendamento
                  </>
                )}
              </button>
            </div>
          </section>
        )}
      </form>
    </main>
  );
}
