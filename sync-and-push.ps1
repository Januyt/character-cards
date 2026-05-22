# Publie le module existant sans reecrire character-cards.js.

$moduleDir = "$env:USERPROFILE\Desktop\character-cards"

Write-Host ""
Write-Host "=== Character Cards - Publication ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $moduleDir)) {
    Write-Host "[ERREUR] Dossier introuvable : $moduleDir" -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

$moduleJsonPath = Join-Path $moduleDir "module.json"
if (-not (Test-Path $moduleJsonPath)) {
    Write-Host "[ERREUR] module.json introuvable." -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

$json = Get-Content $moduleJsonPath -Raw | ConvertFrom-Json
$parts = @($json.version.Split("."))
while ($parts.Count -lt 3) { $parts += "0" }
$json.version = "$($parts[0]).$($parts[1]).$([int]$parts[2] + 1)"
$json | ConvertTo-Json -Depth 20 | Set-Content $moduleJsonPath -Encoding UTF8
Write-Host "  OK  module.json -> $($json.version)" -ForegroundColor Green

git config --global --add safe.directory ($moduleDir -replace "\\", "/") | Out-Null
Set-Location $moduleDir

git status --short
git add .

$msg = Read-Host "Message de commit (Entree = 'Mise a jour du module')"
if ([string]::IsNullOrWhiteSpace($msg)) { $msg = "Mise a jour du module" }

$commitOut = git commit -m $msg 2>&1
Write-Host $commitOut

if ($LASTEXITCODE -ne 0) {
    Write-Host "[INFO] Rien de nouveau a publier." -ForegroundColor DarkGray
    Read-Host "Appuyez sur Entree pour quitter"
    exit 0
}

git push
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "OK - Version $($json.version) publiee sur GitHub !" -ForegroundColor Green
    Write-Host "Mettez a jour le module dans Foundry." -ForegroundColor Cyan
} else {
    Write-Host "[ERREUR] git push a echoue." -ForegroundColor Red
}

Write-Host ""
Read-Host "Appuyez sur Entree pour quitter"
