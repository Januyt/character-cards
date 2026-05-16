# sync-and-push.ps1
# Copie les fichiers du module depuis le dossier Claude vers le Bureau, puis pousse sur GitHub.
# Placez ce fichier n'importe ou et double-cliquez dessus.

$source = "C:\Users\Eric\AppData\Roaming\Claude\local-agent-mode-sessions\9e501845-631f-4016-8bde-f5dba1aa8ff8\72e2c111-bd25-4e4f-a8ec-5af984787f64\local_f00cd004-1502-4c1f-9f90-955450d1ba9f\outputs\character-cards"
$dest   = "$env:USERPROFILE\Desktop\character-cards"

Write-Host ""
Write-Host "=== Character Cards - Sync + Publication ===" -ForegroundColor Cyan
Write-Host ""

# Verification des dossiers
if (-not (Test-Path $source)) {
    Write-Host "[ERREUR] Dossier source introuvable :" -ForegroundColor Red
    Write-Host "  $source" -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

if (-not (Test-Path $dest)) {
    Write-Host "[ERREUR] Dossier du module introuvable sur le Bureau :" -ForegroundColor Red
    Write-Host "  $dest" -ForegroundColor Red
    Read-Host "Appuyez sur Entree pour quitter"
    exit 1
}

# Fichiers a copier
$files = @(
    @{ From = "scripts\character-cards.js";  To = "scripts\character-cards.js" },
    @{ From = "styles\character-cards.css";  To = "styles\character-cards.css" },
    @{ From = "module.json";                 To = "module.json" }
)

Write-Host "Copie des fichiers mis a jour..." -ForegroundColor Yellow

foreach ($f in $files) {
    $src = Join-Path $source $f.From
    $dst = Join-Path $dest  $f.To

    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "  OK  $($f.To)" -ForegroundColor Green
    } else {
        Write-Host "  --  $($f.From) (non trouve, ignore)" -ForegroundColor DarkGray
    }
}

Write-Host ""
Write-Host "Publication sur GitHub..." -ForegroundColor Yellow

Set-Location $dest

git add .

$msg = Read-Host "Message de commit (Entree pour 'Mise a jour du module')"
if ([string]::IsNullOrWhiteSpace($msg)) { $msg = "Mise a jour du module" }

$commitResult = git commit -m $msg 2>&1
Write-Host $commitResult

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[INFO] Rien de nouveau a publier." -ForegroundColor DarkGray
    Read-Host "Appuyez sur Entree pour quitter"
    exit 0
}

git push
if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "OK - Publie sur GitHub !" -ForegroundColor Green
    Write-Host "Pensez a mettre a jour le module dans Foundry." -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "[ERREUR] git push a echoue. Verifiez votre connexion." -ForegroundColor Red
}

Write-Host ""
Read-Host "Appuyez sur Entree pour quitter"
