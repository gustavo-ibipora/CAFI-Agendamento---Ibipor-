import { useEffect, useRef, useState } from 'react';
import { aplicarMascaraData, dataBrParaIso, dataIsoParaBr, somenteDigitos } from '../utils.js';

// Ícone de calendário SVG monocromático
function IconeCalendario() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

const ESTILO_BOTAO_ICONE = {
  position: 'absolute',
  right: '6px',
  background: 'transparent',
  backgroundColor: 'transparent',
  border: 'none',
  boxShadow: 'none',
  outline: 'none',
  cursor: 'pointer',
  padding: '6px',
  minHeight: 'auto',
  height: 'auto',
  width: 'auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--cinza-suave)',
  borderRadius: '4px',
};

const ESTILO_PICKER_OCULTO = {
  position: 'absolute',
  right: 0,
  width: '1px',
  height: '1px',
  opacity: 0,
  pointerEvents: 'none',
  zIndex: -1,
};

/**
 * CampoDataInput — campo de data com máscara DD/MM/AAAA + ícone de calendário.
 *
 * Props:
 *   apenasIcone: quando true, a digitação é bloqueada. A data só pode ser
 *                escolhida pelo date picker nativo (ícone de calendário).
 */
export default function CampoDataInput({
  id,
  label,
  obrigatorio = false,
  valorIso,
  onChangeIso,
  minIso,
  maxIso,
  className = '',
  mensagemErro,
  ajudaTexto,
  ajudaId,
  erroId,
  onBlur,
  larguraTotal = false,
  mostrarIcone = true,
  apenasIcone = false,
}) {
  const [texto, setTexto] = useState(() => dataIsoParaBr(valorIso) || '');
  const pickerRef = useRef(null);

  // Sincroniza quando valorIso muda externamente (ex: date picker ou reset)
  useEffect(() => {
    setTexto(dataIsoParaBr(valorIso) || '');
  }, [valorIso]);

  function abrirCalendario() {
    if (!pickerRef.current) return;
    if (typeof pickerRef.current.showPicker === 'function') {
      pickerRef.current.showPicker();
    } else {
      pickerRef.current.focus();
      pickerRef.current.click();
    }
  }

  // --- Modo digitação normal com máscara sequencial ---
  function handleChange(e) {
    if (apenasIcone) return; // bloqueado no modo somente ícone

    const novoValor = e.target.value;
    const mascarado = aplicarMascaraData(novoValor);
    setTexto(mascarado);
    onChangeIso(dataBrParaIso(mascarado));
  }

  // Apagar sequencialmente: remove 1 char (o último dígito), sem
  // reformatar toda a string (evita "saltar" posições pela máscara).
  function handleKeyDown(e) {
    if (apenasIcone) {
      // No modo somente ícone qualquer tecla de digitação é ignorada
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'Backspace') {
      e.preventDefault();

      const digits = somenteDigitos(texto);
      if (digits.length === 0) return;

      // Remove o último dígito e reforma a máscara
      const novoDigits = digits.slice(0, -1);
      const mascarado = aplicarMascaraData(novoDigits);
      setTexto(mascarado);
      onChangeIso(dataBrParaIso(mascarado));
    }
  }

  return (
    <div className={`campo${larguraTotal ? ' largura-total' : ''} ${className}`.trim()}>
      {label && (
        <label htmlFor={id}>
          {label}{obrigatorio && <span className="etiqueta-obrigatorio">Obrigatório</span>}
        </label>
      )}
      <div className="date-input-wrapper" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          id={id}
          className={mensagemErro ? 'campo-invalido' : ''}
          value={texto}
          placeholder="DD/MM/AAAA"
          inputMode={apenasIcone ? 'none' : 'numeric'}
          autoComplete="off"
          maxLength="10"
          readOnly={apenasIcone}
          required={obrigatorio}
          aria-invalid={Boolean(mensagemErro)}
          aria-describedby={[ajudaId, erroId].filter(Boolean).join(' ') || undefined}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onBlur={onBlur}
          style={{
            ...(mostrarIcone ? { paddingRight: '36px' } : {}),
            ...(apenasIcone ? { cursor: 'default' } : {}),
          }}
        />
        {mostrarIcone && (
          <button
            type="button"
            aria-label="Selecionar data no calendário"
            title="Abrir calendário"
            onClick={abrirCalendario}
            style={ESTILO_BOTAO_ICONE}
          >
            <IconeCalendario />
          </button>
        )}

        {/* Input nativo oculto — apenas para acionar o date picker do navegador */}
        <input
          type="date"
          ref={pickerRef}
          value={valorIso || ''}
          min={minIso}
          max={maxIso}
          onChange={(e) => {
            if (e.target.value) onChangeIso(e.target.value);
          }}
          tabIndex={-1}
          style={ESTILO_PICKER_OCULTO}
        />
      </div>
      {ajudaTexto && <p className="campo-ajuda" id={ajudaId}>{ajudaTexto}</p>}
      {mensagemErro && <p className="campo-erro-texto" id={erroId}>{mensagemErro}</p>}
    </div>
  );
}
