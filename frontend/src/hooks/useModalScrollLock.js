import { useEffect } from 'react';

let modaisAbertos = 0;

export default function useModalScrollLock(open) {
  useEffect(() => {
    if (!open) return undefined;

    modaisAbertos += 1;
    document.body.classList.add('modal-aberto');

    return () => {
      modaisAbertos = Math.max(0, modaisAbertos - 1);
      if (modaisAbertos === 0) document.body.classList.remove('modal-aberto');
    };
  }, [open]);
}
