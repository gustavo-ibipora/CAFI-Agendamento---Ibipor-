export default function Footer() {
  const ano = new Date().getFullYear();

  return (
    <footer className="rodape" role="contentinfo">
      <div className="rodape-conteudo">
        <p className="rodape-principal">
          Prefeitura Municipal de Ibiporã-PR — Secretaria Municipal de Saúde
        </p>
        <p className="rodape-sub">
          Central de Abastecimento Farmacêutico &nbsp;·&nbsp; (43) 3178-8470 &nbsp;·&nbsp; Segunda a sexta, das 8h às 15h
        </p>
        <p className="rodape-copy">
          © {ano} Prefeitura Municipal de Ibiporã. Todos os direitos reservados.
        </p>
        <p className="rodape-creditos" style={{ marginTop: '5px', fontSize: '0.85em', opacity: 0.8 }}>
          Desenvolvido por Gustavo Betiati Ferreira
        </p>
      </div>
    </footer>
  );
}
