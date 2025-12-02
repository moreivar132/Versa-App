$files = @(
    "manager-taller-clientes.html",
    "manager-taller-inventario.html",
    "manager-taller-proveedores.html",
    "manager-taller-trabajadores.html",
    "manager-taller-vehiculos.html",
    "manager-taller.html"
)

foreach ($file in $files) {
    $path = "frontend\$file"
    if (Test-Path $path) {
        $content = Get-Content $path -Raw
        if ($content -notmatch '<script src="guard.js"></script>') {
            $content = $content -replace '(<head>)', "`$1`n  <script src=`"guard.js`"></script>"
            Set-Content -Path $path -Value $content -NoNewline
            Write-Host "Added guard.js to $file" -ForegroundColor Green
        } else {
            Write-Host "guard.js already in $file" -ForegroundColor Yellow
        }
    }
}

Write-Host "Done!" -ForegroundColor Cyan
