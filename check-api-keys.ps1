# check-api-keys.ps1
# Kontrola platnosti vsech API klicu pro rezervace-app
# Spusteni: .\check-api-keys.ps1
# Klice se zadavaji interaktivne pri prvnim spusteni
# S parametry: .\check-api-keys.ps1 -SupabaseKey "sb_sec..." -ResendKey "re_..." -FioToken "12YP..." -InternalToken "..."

param(
    [string]$SupabaseKey,
    [string]$ResendKey,
    [string]$FioToken,
    [string]$InternalToken
)

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Rezervace-App - Kontrola API klicu" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$results = @()

# --- Supabase ---
if (-not $SupabaseKey) { $SupabaseKey = Read-Host "SUPABASE_SERVICE_KEY" }
$base = "https://arcutrsftxarurghmtqj.supabase.co"
try {
    $r = Invoke-RestMethod -Uri "$base/rest/v1/tenants?select=id&limit=1" -Headers @{
        "apikey" = $SupabaseKey; "Authorization" = "Bearer $SupabaseKey"
    }
    Write-Host "[OK]     Supabase DB       - $($r.Count) tenant(u)" -ForegroundColor Green
    $results += @{ Service = "Supabase DB"; Status = "OK" }

    $auth = Invoke-RestMethod -Uri "$base/auth/v1/settings" -Headers @{ "apikey" = $SupabaseKey }
    Write-Host "[OK]     Supabase Auth     - email auth: $($auth.external.email)" -ForegroundColor Green
    $results += @{ Service = "Supabase Auth"; Status = "OK" }
} catch {
    Write-Host "[CHYBA]  Supabase          - $($_.Exception.Message)" -ForegroundColor Red
    $results += @{ Service = "Supabase"; Status = "CHYBA" }
}

# --- Resend ---
if (-not $ResendKey) { $ResendKey = Read-Host "RESEND_API_KEY" }
try {
    Invoke-RestMethod -Method Post -Uri "https://api.resend.com/emails" -Headers @{
        "Authorization" = "Bearer $ResendKey"; "Content-Type" = "application/json"
    } -Body '{"from":"test@bass443.com","to":"x@x.com","subject":"t","html":"t"}'
    Write-Host "[OK]     Resend            - email odeslan" -ForegroundColor Green
    $results += @{ Service = "Resend"; Status = "OK" }
} catch {
    $errBody = $_.ErrorDetails.Message
    if ($errBody -match "validation_error|restricted_api_key|not verified") {
        Write-Host "[OK]     Resend            - klic platny (domena neoverena)" -ForegroundColor Yellow
        $results += @{ Service = "Resend"; Status = "OK (domena neoverena)" }
    } elseif ($errBody -match "401") {
        Write-Host "[CHYBA]  Resend            - neplatny klic!" -ForegroundColor Red
        $results += @{ Service = "Resend"; Status = "CHYBA" }
    } else {
        Write-Host "[WARN]   Resend            - $errBody" -ForegroundColor Yellow
        $results += @{ Service = "Resend"; Status = "WARN" }
    }
}

# --- Fio (30s rate limit) ---
if (-not $FioToken) { $FioToken = Read-Host "FIO_PLATFORM_TOKEN" }
$today = Get-Date -Format "yyyy-MM-dd"
$weekAgo = (Get-Date).AddDays(-7).ToString("yyyy-MM-dd")
try {
    $r = Invoke-RestMethod -Uri "https://fioapi.fio.cz/v1/rest/periods/$FioToken/$weekAgo/$today/transactions.json"
    $info = $r.accountStatement.info
    Write-Host "[OK]     Fio banka         - $($info.iban) ($($info.currency))" -ForegroundColor Green
    $results += @{ Service = "Fio"; Status = "OK" }
} catch {
    if ($_.Exception.Message -match "409") {
        Write-Host "[WARN]   Fio banka         - rate limit (zkuste za 30s)" -ForegroundColor Yellow
        $results += @{ Service = "Fio"; Status = "WARN (rate limit)" }
    } else {
        Write-Host "[CHYBA]  Fio banka         - token expiroval nebo neplatny!" -ForegroundColor Red
        $results += @{ Service = "Fio"; Status = "CHYBA" }
    }
}

# --- Admin-API worker ---
if (-not $InternalToken) { $InternalToken = Read-Host "INTERNAL_AUTH_TOKEN" }
try {
    $r = Invoke-RestMethod -Uri "https://admin-api.bass443.workers.dev/health"
    Write-Host "[OK]     Admin-API worker  - health OK" -ForegroundColor Green
    $results += @{ Service = "Admin-API"; Status = "OK" }
} catch {
    Write-Host "[CHYBA]  Admin-API worker  - $($_.Exception.Message)" -ForegroundColor Red
    $results += @{ Service = "Admin-API"; Status = "CHYBA" }
}

# --- Souhrn ---
$errors = ($results | Where-Object { $_.Status -match "CHYBA" }).Count
$warnings = ($results | Where-Object { $_.Status -match "WARN" }).Count
Write-Host "`n========================================" -ForegroundColor Cyan
if ($errors -eq 0 -and $warnings -eq 0) {
    Write-Host "  VYSLEDEK: Vsechny klice OK" -ForegroundColor Green
} elseif ($errors -eq 0) {
    Write-Host "  VYSLEDEK: OK s $warnings varovani(mi)" -ForegroundColor Yellow
} else {
    Write-Host "  VYSLEDEK: $errors sluzba/sluzby maji problem!" -ForegroundColor Red
}
Write-Host "========================================`n" -ForegroundColor Cyan
