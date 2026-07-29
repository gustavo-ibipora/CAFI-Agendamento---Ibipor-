export default function Message({ type = 'erro', children }) {
  if (!children) return null;
  return <div className={type === 'sucesso' ? 'mensagem-sucesso' : 'mensagem-erro'}>{children}</div>;
}
