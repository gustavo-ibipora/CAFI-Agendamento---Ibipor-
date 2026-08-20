import { useEffect, useRef, useState } from 'react';
import { apiJson, jsonOptions } from '../api.js';
import {
  aplicarMascaraCpf,
  aplicarMascaraTelefone,
  amanhaISO,
  cpfValido,
  ehFimDeSemana,
  emailValido,
  hojeISO,
  somenteDigitos,
  telefoneValido
} from '../utils.js';
import Message from './Message.jsx';
import CampoDataInput from './CampoDataInput.jsx';
import useModalScrollLock from '../hooks/useModalScrollLock.js';

const hoje = hojeISO();
const amanha = amanhaISO();

function estadoInicial(dataInicial) {
  return {
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
    data_agendamento: dataInicial && dataInicial >= amanha ? dataInicial : '',
    horario: '',
    encaixe: false
  };
}

export default function NovoAgendamentoModal({ open, dataInicial, opcoesUbs, opcoesMedicamento, onClose, onCriado }) {
  const formRef = useRef(null);
  const cpfBuscadoRef = useRef('');
  const cpfAtualRef = useRef('');
  const [form, setForm] = useState(() => estadoInicial(dataInicial));
  const [horarios, setHorarios] = useState([]);
  const [carregandoHorarios, setCarregandoHorarios] = useState(false);
  const [avisoPaciente, setAvisoPaciente] = useState(null);
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  useModalScrollLock(open);

  useEffect(() => {
    if (!open) return;
    setForm(estadoInicial(dataInicial));
    setErro('');
    setAvisoPaciente(null);
    cpfBuscadoRef.current = '';
    // Reabre o formulário limpo a cada abertura do modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const timeout = setTimeout(buscarPacientePorCpf, 350);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cpf, open]);

  useEffect(() => {
    if (!open) return;
    carregarHorarios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, form.data_agendamento, form.primeiro_atendimento]);

  if (!open) return null;

  function atualizar(campo, valor) {
    if (campo === 'cpf') cpfAtualRef.current = valor;
    setForm((atual) => ({ ...atual, [campo]: valor }));
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

  async function carregarHorarios() {
    setHorarios([]);
    if (!form.data_agendamento || !form.primeiro_atendimento) return;
    if (ehFimDeSemana(form.data_agendamento)) return;

    setCarregandoHorarios(true);
    try {
      const params = new URLSearchParams({
        data: form.data_agendamento,
        primeiroAtendimento: String(form.primeiro_atendimento === 'sim')
      });
      const dados = await apiJson(`/api/admin/horarios-disponiveis?${params.toString()}`);
      setHorarios(dados.blocos || []);
    } catch (err) {
      setErro(err.message || 'Erro ao carregar horários.');
    } finally {
      setCarregandoHorarios(false);
    }
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErro('');

    if (!formRef.current.checkValidity()) {
      formRef.current.reportValidity();
      return;
    }
    if (!cpfValido(form.cpf)) return setErro('Informe um CPF válido.');
    if (form.telefone && !telefoneValido(form.telefone)) return setErro('Informe um telefone válido, com DDD.');
    if (form.email && !emailValido(form.email)) return setErro('Informe um e-mail válido.');
    if (form.data_nascimento > hoje) return setErro('Data de nascimento não pode ser futura.');
    if (form.previsao_termino < hoje) return setErro('Previsão de término não pode ser no passado.');
    if (ehFimDeSemana(form.data_agendamento)) return setErro('A farmácia atende apenas de segunda a sexta.');
    if (form.data_agendamento < (form.encaixe ? hoje : amanha)) {
      return setErro(form.encaixe ? 'A data do agendamento não pode ser no passado.' : 'Escolha uma data a partir do dia seguinte.');
    }
    if (!form.horario) return setErro('Selecione um horário.');

    setEnviando(true);
    try {
      const dados = await apiJson('/api/admin/agendamentos', jsonOptions({
        nome_completo: form.nome_completo.trim(),
        cpf: somenteDigitos(form.cpf),
        data_nascimento: form.data_nascimento,
        endereco: form.endereco.trim(),
        telefone: somenteDigitos(form.telefone),
        email: form.email.trim(),
        ubs: form.ubs,
        tipo_medicamento: form.tipo_medicamento,
        primeiro_atendimento: form.primeiro_atendimento === 'sim',
        previsao_termino: form.previsao_termino,
        observacoes: form.observacoes.trim(),
        data_agendamento: form.data_agendamento,
        horario: form.horario,
        encaixe: form.encaixe
      }));
      onCriado(dados);
    } catch (err) {
      setErro(err.message || 'Não foi possível incluir o agendamento.');
      if (['HORARIO_LOTADO', 'HORARIO_BLOQUEADO', 'LIMITE_ATB'].includes(err.codigo)) carregarHorarios();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-fundo" onClick={onClose}>
      <div
        className="modal-conteudo"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-novo-agendamento"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="modal-cabecalho">
          <h2 id="titulo-novo-agendamento">Novo agendamento</h2>
          <button type="button" className="secundario" onClick={onClose}>Fechar</button>
        </div>

        <Message>{erro}</Message>

        <form ref={formRef} className="grade" noValidate onSubmit={enviar}>
          <div className="campo">
            <label htmlFor="na-cpf">CPF do paciente <span className="etiqueta-obrigatorio">Obrigatório</span></label>
            <input id="na-cpf" value={form.cpf} placeholder="000.000.000-00" maxLength="14" inputMode="numeric" autoComplete="off" required
              onChange={(e) => atualizar('cpf', aplicarMascaraCpf(e.target.value))} />
          </div>

          <div className="campo largura-total">
            <Message type={avisoPaciente?.tipo}>{avisoPaciente?.texto}</Message>
          </div>

          <div className="campo largura-total">
            <label htmlFor="na-nome">Nome completo <span className="etiqueta-obrigatorio">Obrigatório</span></label>
            <input id="na-nome" value={form.nome_completo} maxLength="150" autoComplete="name" required
              onChange={(e) => atualizar('nome_completo', e.target.value)} />
          </div>

          <CampoDataInput
            id="na-nascimento"
            label="Data de nascimento"
            obrigatorio
            valorIso={form.data_nascimento}
            maxIso={hoje}
            onChangeIso={(valor) => atualizar('data_nascimento', valor)}
          />

          <div className="campo">
            <label htmlFor="na-telefone">Telefone <span className="etiqueta-opcional">Opcional</span></label>
            <input type="tel" id="na-telefone" value={form.telefone} placeholder="(43) 90000-0000" maxLength="15" inputMode="tel"
              onChange={(e) => atualizar('telefone', aplicarMascaraTelefone(e.target.value))} />
          </div>

          <div className="campo largura-total">
            <label htmlFor="na-endereco">Endereço <span className="etiqueta-obrigatorio">Obrigatório</span></label>
            <input id="na-endereco" value={form.endereco} maxLength="255" autoComplete="street-address" required
              onChange={(e) => atualizar('endereco', e.target.value)} />
          </div>

          <div className="campo">
            <label htmlFor="na-email">E-mail <span className="etiqueta-opcional">Opcional</span></label>
            <input type="email" id="na-email" value={form.email} maxLength="150"
              onChange={(e) => atualizar('email', e.target.value)} />
          </div>

          <div className="campo">
            <label htmlFor="na-ubs">UBS de referência <span className="etiqueta-obrigatorio">Obrigatório</span></label>
            <select id="na-ubs" value={form.ubs} required onChange={(e) => atualizar('ubs', e.target.value)}>
              <option value="">Selecione...</option>
              {opcoesUbs.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <div className="campo">
            <label htmlFor="na-medicamento">Tipo de medicamento <span className="etiqueta-obrigatorio">Obrigatório</span></label>
            <select id="na-medicamento" value={form.tipo_medicamento} required onChange={(e) => atualizar('tipo_medicamento', e.target.value)}>
              <option value="">Selecione...</option>
              {opcoesMedicamento.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>

          <CampoDataInput
            id="na-previsao"
            label="Previsão de término da medicação"
            obrigatorio
            valorIso={form.previsao_termino}
            onChangeIso={(valor) => atualizar('previsao_termino', valor)}
          />

          <div className="campo largura-total">
            <label>Primeiro atendimento? <span className="etiqueta-obrigatorio">Obrigatório</span></label>
            <div className="radio-grupo">
              <label><input type="radio" name="na-primeiro" value="sim" checked={form.primeiro_atendimento === 'sim'} required
                onChange={(e) => atualizar('primeiro_atendimento', e.target.value)} /> Sim</label>
              <label><input type="radio" name="na-primeiro" value="nao" checked={form.primeiro_atendimento === 'nao'} required
                onChange={(e) => atualizar('primeiro_atendimento', e.target.value)} /> Não</label>
            </div>
          </div>

          <div className="campo largura-total campo-encaixe">
            <label className="toggle-linha">
              <input type="checkbox" checked={form.encaixe} onChange={(e) => atualizar('encaixe', e.target.checked)} />
              Incluir mesmo com a agenda cheia (encaixe)
            </label>
            <p className="campo-ajuda">
              Marque esta opção para incluir o paciente mesmo sem vagas no horário escolhido, ou para agendar para{' '}
              <strong>hoje</strong>. O agendamento será criado e identificado com a marca <strong>Encaixe</strong> na agenda.
            </p>
          </div>

          <CampoDataInput
            id="na-data"
            label="Data do agendamento (segunda a sexta)"
            obrigatorio
            valorIso={form.data_agendamento}
            minIso={form.encaixe ? hoje : amanha}
            onChangeIso={(valor) => atualizar('data_agendamento', valor)}
          />

          <div className="campo">
            <label htmlFor="na-horario">Horário <span className="etiqueta-obrigatorio">Obrigatório</span></label>
            <select id="na-horario" value={form.horario} disabled={carregandoHorarios} required
              onChange={(e) => atualizar('horario', e.target.value)}>
              <option value="">{carregandoHorarios ? 'Carregando...' : 'Selecione...'}</option>
              {horarios.map((bloco) => (
                <option key={bloco.horario} value={bloco.horario} disabled={!bloco.disponivel && !form.encaixe}>
                  {bloco.horario}{!bloco.disponivel ? (form.encaixe ? ' — sem vagas, será encaixe' : ' — sem vagas') : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="campo largura-total">
            <label htmlFor="na-observacoes">Observações (opcional)</label>
            <textarea id="na-observacoes" value={form.observacoes} rows="3" maxLength="2000"
              onChange={(e) => atualizar('observacoes', e.target.value)} />
          </div>

          <div className="acoes acoes-navegacao largura-total">
            <button type="button" className="secundario" onClick={onClose}>Cancelar</button>
            <button type="submit" disabled={enviando}>{enviando ? 'Incluindo...' : 'Incluir agendamento'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
