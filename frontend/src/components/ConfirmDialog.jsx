import useModalScrollLock from '../hooks/useModalScrollLock.js';

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Voltar',
  danger = false,
  onConfirm,
  onCancel
}) {
  useModalScrollLock(open);

  if (!open) return null;

  return (
    <div className="modal-fundo modal-fundo-confirmacao" onClick={onCancel}>
      <div className="modal-conteudo modal-confirmacao" role="dialog" aria-modal="true" aria-labelledby="confirmacao-titulo" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirmacao-titulo">{title}</h2>
        <p>{message}</p>
        <div className="acoes">
          <button type="button" className={danger ? 'botao-cancelar' : ''} onClick={onConfirm}>
            {confirmText}
          </button>
          <button type="button" className="secundario" onClick={onCancel}>
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
}
