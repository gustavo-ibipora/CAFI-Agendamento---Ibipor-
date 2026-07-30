import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <main className="pagina-home">
      {/* Hero / Destaque */}
      <section className="destaque-home" aria-label="Apresentação do serviço">
        <div className="destaque-texto">
          <h2>Agendamento de retirada de medicamentos</h2>
          <p>
            A Farmácia Municipal organiza a retirada de medicamentos
            por agendamento para reduzir filas e facilitar o atendimento.
          </p>
          <p>
            Informe seus dados, escolha uma data útil e reserve um horário disponível.
          </p>
        </div>
        <div className="acoes">
          <Link className="botao" to="/agendamento" id="btn-agendar-hero">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Agendar retirada
          </Link>
          {/*<Link className="botao secundario" to="/admin/login" id="btn-admin-hero">
            Painel administrativo
          </Link>*/}
        </div>
      </section>

      {/* Como funciona */}
      <section className="painel-informacoes" aria-label="Como funciona o agendamento">
        <article>
          <span className="numero-passo" aria-hidden="true">1</span>
          <h3>Escolha um horário</h3>
          <p>
            Consulte primeiro as datas e horários disponíveis para evitar preencher dados
            antes de confirmar uma vaga.
          </p>
        </article>
        <article>
          <span className="numero-passo" aria-hidden="true">2</span>
          <h3>Preencha seus dados</h3>
          <p>
            Informe CPF, nome, endereço e dados de contato. Se o CPF já estiver cadastrado,
            parte das informações será preenchida automaticamente.
          </p>
        </article>
        <article>
          <span className="numero-passo" aria-hidden="true">3</span>
          <h3>Compareça no dia</h3>
          <p>
            Chegue com alguns minutos de antecedência e leve documento com foto para
            realizar a retirada dos medicamentos.
          </p>
        </article>
      </section>

      {/* Informações extras */}
      <section className="cartao informacoes-home" aria-label="Informações importantes antes de agendar">
        <h2>Antes de agendar</h2>
        <div className="lista-informacoes">
          <p>
            <strong>Confirmação por e-mail:</strong> você receberá a confirmação do agendamento
            por e-mail quando o envio estiver configurado.
          </p>
          <p>
            <strong>Dúvidas?</strong> Em caso de dúvidas, procure a Unidade Básica de Saúde
            responsável pelo seu bairro ou ligue: <strong>(43) 3178-8470</strong>.
          </p>
          <p>
            <strong>Atendimento:</strong> segunda a sexta-feira, das 8h às 15h.
            Não realizamos agendamentos para fins de semana ou feriados.
          </p>
        </div>
      </section>
    </main>
  );
}
