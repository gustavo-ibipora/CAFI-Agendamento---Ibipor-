<#
Remove o servico Windows do backend (instalado por install-service.ps1).
Deve ser executado com PowerShell como Administrador.

Se abrir e fechar sozinho sem mostrar nada, voce provavelmente deu duplo-clique no
arquivo em vez de rodar dentro de um PowerShell aberto como Administrador.
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

    if (-not (Test-Path $Nssm)) {
        throw "nssm.exe nao encontrado em $Nssm"
    }

    & $Nssm status $ServiceName *> $null
    if ($LASTEXITCODE -ne 0) {
        throw "O servico '$ServiceName' nao esta instalado."
    }

    Write-Host "Parando servico '$ServiceName' (se estiver rodando)..."
    & $Nssm stop $ServiceName *> $null

    Write-Host "Removendo servico '$ServiceName'..."
    & $Nssm remove $ServiceName confirm
    if ($LASTEXITCODE -ne 0) { throw "Falha ao remover o servico (nssm remove retornou codigo $LASTEXITCODE)." }

    Write-Host ""
    Write-Host "Servico removido." -ForegroundColor Green
    Aguardar-Saida -CodigoSaida 0
}
catch {
    Write-Host ""
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    Aguardar-Saida -CodigoSaida 1
}
