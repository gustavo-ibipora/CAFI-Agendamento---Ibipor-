<#
Instala o backend (server.js) como servico Windows usando o NSSM incluido no repositorio.
Deve ser executado com PowerShell como Administrador, a partir da pasta backend/.

Uso:
    cd backend
    .\scripts\install-service.ps1

Se abrir e fechar sozinho sem mostrar nada, voce provavelmente deu duplo-clique no
arquivo em vez de rodar dentro de um PowerShell aberto como Administrador. Abra o
PowerShell como Administrador primeiro, va ate a pasta backend e so entao execute
o comando acima -- assim a janela fica aberta e mostra qualquer erro.

Para reinstalar do zero, execute antes .\scripts\uninstall-service.ps1
#>

$ErrorActionPreference = 'Stop'

function Aguardar-Saida {
    param([int]$CodigoSaida = 0)
    Write-Host ""
    Write-Host "Pressione Enter para fechar..." -ForegroundColor DarkGray
    [void](Read-Host)
    exit $CodigoSaida
}

try {
    $souAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $souAdmin) {
        throw "Este script precisa ser executado como Administrador. Abra o PowerShell com 'Executar como administrador' e rode o comando novamente."
    }

    $ServiceName = 'CafiAgendamentoBackend'
    $BackendDir  = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
    $Nssm        = Join-Path $BackendDir 'nssm.exe'
    $LogsDir     = Join-Path $BackendDir 'logs'

    if (-not (Test-Path $Nssm)) {
        throw "nssm.exe nao encontrado em $Nssm"
    }
    if (-not (Test-Path (Join-Path $BackendDir '.env'))) {
        throw "backend\.env nao encontrado. Configure o ambiente antes de instalar o servico (veja docs\INSTALACAO.md)."
    }

    $NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $NodeExe) {
        throw "node.exe nao encontrado no PATH. Instale o Node.js antes de continuar (e reabra o PowerShell para o PATH ser atualizado)."
    }

    New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

    & $Nssm status $ServiceName *> $null
    if ($LASTEXITCODE -eq 0) {
        throw "O servico '$ServiceName' ja existe. Rode .\scripts\uninstall-service.ps1 antes de reinstalar."
    }

    Write-Host "Instalando servico '$ServiceName'..."
    & $Nssm install $ServiceName $NodeExe 'server.js'
    if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar o servico (nssm install retornou codigo $LASTEXITCODE)." }

    & $Nssm set $ServiceName AppDirectory $BackendDir
    & $Nssm set $ServiceName AppEnvironmentExtra 'NODE_ENV=production'
    & $Nssm set $ServiceName DisplayName 'CAFI Agendamento - Backend'
    & $Nssm set $ServiceName Description 'API do sistema de agendamento da farmacia (CAFI Ibipora).'
    & $Nssm set $ServiceName Start SERVICE_AUTO_START
    & $Nssm set $ServiceName AppExit Default Restart
    & $Nssm set $ServiceName AppRestartDelay 5000

    # Logs + rotacao (evita crescimento ilimitado do arquivo de log do servico)
    & $Nssm set $ServiceName AppStdout (Join-Path $LogsDir 'servico.log')
    & $Nssm set $ServiceName AppStderr (Join-Path $LogsDir 'servico-erro.log')
    & $Nssm set $ServiceName AppRotateFiles 1
    & $Nssm set $ServiceName AppRotateOnline 1
    & $Nssm set $ServiceName AppRotateSeconds 86400
    & $Nssm set $ServiceName AppRotateBytes 10485760

    Write-Host "Iniciando servico '$ServiceName'..."
    & $Nssm start $ServiceName
    if ($LASTEXITCODE -ne 0) { throw "Servico instalado mas falhou ao iniciar (nssm start retornou codigo $LASTEXITCODE). Veja $LogsDir\servico-erro.log." }

    Write-Host ""
    Write-Host "Servico instalado e iniciado." -ForegroundColor Green
    Write-Host "Logs em: $LogsDir"
    Write-Host "Para checar status: $Nssm status $ServiceName"

    Aguardar-Saida -CodigoSaida 0
}
catch {
    Write-Host ""
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    Aguardar-Saida -CodigoSaida 1
}
