# Execute pessoalmente no Windows. Nunca informe a senha pelo chat.
# A credencial fica criptografada por DPAPI para o usuario atual deste computador.
[CmdletBinding()]
param([switch]$Substituir)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Este cadastro protegido exige Windows (DPAPI).' }
$projectDirectory = Split-Path -Parent $PSScriptRoot
$privateDirectory = Join-Path $projectDirectory '.local'
$credentialPath = Join-Path $privateDirectory 'gmail-credential.dpapi.json'
if ((Test-Path -LiteralPath $credentialPath) -and -not $Substituir) {
    throw 'Ja existe uma credencial cadastrada. Nao foi substituida.'
}
Write-Host 'Conta: nlsoarez@gmail.com'
Write-Host 'Informe a SENHA DE APP gerada pelo Google (16 caracteres), nunca a senha normal da conta.'
Write-Host 'Pode colar os quatro grupos com espacos. Pressione Enter sem digitar para cancelar.'
while ($true) {
$appSecret = Read-Host 'Senha de app (entrada oculta)' -AsSecureString
$secretPointer = [IntPtr]::Zero
try {
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($appSecret)
    $normalizedSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer) -replace '\s', ''
    if ($normalizedSecret.Length -eq 0) { Write-Host 'Cadastro cancelado. Nenhuma credencial foi salva.'; break }
    if ($normalizedSecret -cnotmatch '^[A-Za-z0-9]{16}$') {
        Write-Host ('Foram recebidos {0} caracteres sem espacos. Cole os 16 caracteres da senha de app gerada pelo Google.' -f $normalizedSecret.Length) -ForegroundColor Yellow
        Write-Host 'A entrada nao foi salva nem enviada. Tente novamente.'
        continue
    }
    $normalizedSecureSecret = ConvertTo-SecureString -String $normalizedSecret -AsPlainText -Force
    try {
        $encryptedSecret = ConvertFrom-SecureString -SecureString $normalizedSecureSecret
        $record = [ordered]@{
            version = 1
            protection = 'Windows-DPAPI-CurrentUser'
            username = 'nlsoarez@gmail.com'
            passwordEncrypted = $encryptedSecret
        }
        [void][IO.Directory]::CreateDirectory($privateDirectory)
        # CreateNew impede sobrescrever outra credencial mesmo em execucoes concorrentes.
        $writePath = if ($Substituir) { Join-Path $privateDirectory ('gmail-' + [Guid]::NewGuid().ToString('N') + '.dpapi.tmp') } else { $credentialPath }
        $stream = [IO.File]::Open($writePath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try {
            $bytes = [Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Compress))
            $stream.Write($bytes, 0, $bytes.Length)
        } finally { $stream.Dispose() }
        if ($Substituir) { Move-Item -LiteralPath $writePath -Destination $credentialPath -Force }
        Write-Host 'Credencial salva com criptografia local. Nenhum e-mail foi enviado.'
        break
    } finally { if ($normalizedSecureSecret) { $normalizedSecureSecret.Dispose() } }
} finally {
    if ($secretPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer) }
    $normalizedSecret = $null
    $appSecret.Dispose()
}
}
