# Instalacao Local

Guia curto para preparar o sistema em ambiente de desenvolvimento.

## Requisitos

- Node.js 18 ou superior.
- MySQL local ou remoto.
- Terminal PowerShell, Prompt de Comando ou equivalente.

## Configurar ambiente

1. Copie `backend/.env.example` para `backend/.env`.
2. Edite `backend/.env` com os dados do seu MySQL.
3. Defina um valor longo e aleatorio em `SESSION_SECRET`.
4. Deixe os campos `SMTP_*` vazios se o e-mail ainda nao estiver configurado.

## Criar banco de dados

Na raiz do projeto, execute:

```powershell
mysql -u root -p < backend\sql\schema.sql
```

Se o seu MySQL local nao usa senha para `root`, o comando pode ser:

```powershell
mysql -u root < backend\sql\schema.sql
```

## Instalar dependencias

```powershell
cd backend
npm install
```

## Criar administrador

Dentro da pasta `backend`, execute:

```powershell
npm run create-admin -- admin "SenhaForte@123" "Administrador"
```

Troque `admin`, `SenhaForte@123` e `Administrador` pelos dados desejados.

A senha precisa ter pelo menos 10 caracteres, letra maiuscula, letra minuscula, numero e caractere especial.

## Aplicar migracoes de seguranca

Se o banco ja existia antes das melhorias de seguranca, execute:

```powershell
cd backend
npm run migrate:security
```

Esse comando cria/verifica a tabela de sessoes e adiciona a coluna `ativo` na tabela `admins`.

## Aplicar migracoes de validacao

Se o banco ja existia antes das melhorias de validacao, execute:

```powershell
cd backend
npm run migrate:validation
```

Esse comando normaliza os valores de `tipo_medicamento` para os valores aceitos pela API.

## Aplicar migracoes de banco de dados

Para criar as tabelas de dominio, slots de capacidade, indices adicionais e popular dados iniciais:

```powershell
cd backend
npm run migrate:database
```

## Aplicar migracao de email

Para criar a fila persistente de e-mails:

```powershell
cd backend
npm run migrate:email
```

Quando o SMTP estiver configurado, o agendamento apenas enfileira o e-mail e o worker do servidor envia em segundo plano.

## Aplicar migracao de pacientes

Para criar a tabela de pacientes e copiar os dados de pacientes que ja possuem agendamentos:

```powershell
cd backend
npm run migrate:patients
```

Essa tabela permite buscar um paciente pelo CPF e preencher automaticamente os dados no agendamento publico.

## Aplicar migracao de auditoria

Para registrar `created_by`/`updated_by`, guardar auditoria de acoes administrativas e liberar a aba de logs:

```powershell
cd backend
npm run migrate:audit
```

Administradores podem consultar esses eventos no painel em `Logs`.

## Regras de capacidade

- Paciente de primeiro atendimento ocupa 2 vagas no bloco escolhido.
- O limite diario de Antibiotico e de 10 agendamentos.
- Apenas agendamentos com status `cancelado` liberam vaga.
- Agendamentos `confirmado`, `atendido` e `faltou` continuam ocupando capacidade.

## Instalar o backend como servico Windows (producao)

O backend deve rodar em producao como servico Windows (nao com `npm start`/`nodemon` em um terminal aberto), usando o NSSM incluido em `backend\nssm.exe`.

1. Configure `backend\.env` com os dados de producao (MySQL, `SESSION_SECRET` forte, `SESSION_COOKIE_SECURE=true`, `CORS_ORIGIN`, etc.) e rode as migracoes necessarias.
2. Abra o PowerShell **como Administrador** (menu Iniciar -> PowerShell -> botao direito -> "Executar como administrador"). Nao use duplo-clique no arquivo `.ps1`: o Windows abre e fecha a janela sozinho, sem dar tempo de ler um eventual erro.
3. Dentro do PowerShell aberto como Administrador, execute:

   ```powershell
   cd backend
   .\scripts\install-service.ps1
   ```

   Se aparecer um erro sobre politica de execucao de scripts ("running scripts is disabled"), rode assim:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\scripts\install-service.ps1
   ```

   O script agora sempre para no final (sucesso ou erro) e pede para apertar Enter antes de fechar, para dar tempo de ler a mensagem.

   O script cria o servico `CafiAgendamentoBackend` configurado para:
   - iniciar automaticamente com o Windows (`SERVICE_AUTO_START`);
   - reiniciar sozinho se o processo cair (`AppExit Default Restart`);
   - rodar com `NODE_ENV=production`;
   - gravar stdout/stderr em `backend\logs\servico.log` e `backend\logs\servico-erro.log`, com rotacao automatica (por tamanho de 10 MB ou a cada 24h), evitando que o log cresca sem limite.

4. Verifique o status: `backend\nssm.exe status CafiAgendamentoBackend`.
5. Para remover o servico (ex.: antes de reinstalar): `.\scripts\uninstall-service.ps1` (tambem como Administrador).

O IIS deve ficar apenas com o proxy reverso para `http://127.0.0.1:3000` (ver `frontend\dist\web.config`); quem mantem o processo Node vivo e reiniciado em caso de queda/reboot do servidor e o servico NSSM, nao o IIS.

## Operacao em producao

- Backup do banco: executar dump diario do MySQL, armazenar copia fora do servidor e testar restauracao mensalmente. Exemplo: `mysqldump -u usuario -p farmacia_ibipora > backup-farmacia-YYYY-MM-DD.sql`.
- Retencao de dados pessoais: manter agendamentos e dados de pacientes pelo prazo definido pela Secretaria de Saude/juridico; depois anonimizar ou excluir registros antigos por rotina controlada.
- HTTPS/proxy reverso: publicar o Node.js atras de Nginx, Apache ou IIS com certificado TLS valido, redirecionamento HTTP para HTTPS e `SESSION_COOKIE_SECURE=true`.
- Homologacao: manter um ambiente separado de producao, com banco proprio e dados ficticios/anonimizados, para validar migracoes e novas versoes antes da troca oficial.

## Iniciar o sistema

Para rodar manualmente em primeiro plano (teste local/depuracao):

```powershell
cd backend
npm start
```

Para desenvolvimento com reinicio automatico do Node.js:

```powershell
cd backend
npm run dev
```

Em producao, nao use `npm start` num terminal aberto — instale como servico Windows (veja "Instalar o backend como servico Windows" acima), para que o processo sobreviva a reinicializacoes do servidor e reinicie sozinho em caso de falha.

Depois acesse:

- Agendamento publico: http://localhost:3000
- Painel administrativo: http://localhost:3000/admin/login.html

## Validar comandos basicos

Para executar o smoke test atual:

```powershell
cd backend
npm test
```

## Variaveis do `.env`

- `DB_HOST`: host do MySQL, normalmente `localhost`.
- `DB_USER`: usuario do MySQL.
- `DB_PASSWORD`: senha do usuario MySQL. Pode ficar vazio em ambiente local.
- `DB_NAME`: nome do banco usado pelo sistema.
- `DB_PORT`: porta do MySQL, normalmente `3306`.
- `SESSION_SECRET`: segredo usado para assinar a sessao do painel administrativo.
- `SESSION_COOKIE_SECURE`: use `true` em producao com HTTPS.
- `SESSION_COOKIE_SAMESITE`: politica SameSite do cookie, normalmente `lax`.
- `CORS_ORIGIN`: dominio autorizado a chamar a API. Vazio nao libera CORS; funciona bem quando o frontend e servido pelo mesmo Express.
- `LOGIN_RATE_LIMIT_WINDOW_MS`: janela do limite de tentativas de login, em milissegundos.
- `LOGIN_RATE_LIMIT_MAX`: quantidade maxima de tentativas de login por janela.
- `AGENDAMENTO_RATE_LIMIT_WINDOW_MS`: janela do limite de criacao de agendamentos, em milissegundos.
- `AGENDAMENTO_RATE_LIMIT_MAX`: quantidade maxima de criacoes de agendamento por janela.
- `SMTP_HOST`: servidor SMTP para envio de e-mail.
- `SMTP_PORT`: porta SMTP, normalmente `587` ou `465`.
- `SMTP_USER`: usuario SMTP.
- `SMTP_PASS`: senha SMTP.
- `SMTP_FROM`: remetente das mensagens.
- `EMAIL_WORKER_INTERVAL_MS`: intervalo do worker que processa a fila de e-mails.
- `PORT`: porta HTTP do servidor Express.

## Administradores

Para desativar um administrador:

```powershell
cd backend
npm run set-admin-active -- admin inativo
```

Para reativar:

```powershell
cd backend
npm run set-admin-active -- admin ativo
```

Administradores logados tambem podem alterar a propria senha pelo painel, no link `Senha`.
