function Analyze-CSSClasses {
    param (
        $globalsPath,
        $modulePath,
        $tsxPath,
        $searchDir
    )

    $classRegex = '(?m)\.([A-Za-z_][A-Za-z0-9_-]*)'

    # 1. Analyze Module Classes
    if (Test-Path $modulePath) {
        $moduleContent = Get-Content $modulePath -Raw
        $moduleClasses = [regex]::Matches($moduleContent, $classRegex) | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique | Sort-Object
        
        $tsxContent = Get-Content $tsxPath -Raw
        $usedModule = @()
        $unusedModule = @()

        foreach ($cls in $moduleClasses) {
            if ($tsxContent -match "\bstyles\.$cls\b") {
                $usedModule += $cls
            } else {
                $unusedModule += $cls
            }
        }

        Write-Host "--- MODULE CLASSES (app/order/KioskOrderPage.module.css) ---"
        Write-Host "Total: $($moduleClasses.Count)"
        Write-Host "Used: $($usedModule.Count)"
        Write-Host "Unused: $($unusedModule.Count)"
        Write-Host "Unused Names: $($unusedModule -join ', ')"
        Write-Host ""
    }

    # 2. Analyze Global Classes
    if (Test-Path $globalsPath) {
        $globalsContent = Get-Content $globalsPath -Raw
        $globalClasses = [regex]::Matches($globalsContent, $classRegex) | ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique | Sort-Object
        
        $searchFiles = Get-ChildItem -Path $searchDir -Include *.tsx, *.ts, *.jsx, *.js, index.html -Recurse | Where-Object { $_.FullName -notmatch '\.css$' }
        $fileContents = $searchFiles | ForEach-Object { Get-Content $_.FullName -Raw }

        $usedGlobals = @()
        $unusedGlobals = @()

        foreach ($cls in $globalClasses) {
            $found = $false
            foreach ($content in $fileContents) {
                if ($content -match "\b$cls\b") {
                    $found = $true
                    break
                }
            }
            if ($found) {
                $usedGlobals += $cls
            } else {
                $unusedGlobals += $cls
            }
        }

        Write-Host "--- GLOBAL CLASSES (app/globals.css) ---"
        Write-Host "Total: $($globalClasses.Count)"
        Write-Host "Used: $($usedGlobals.Count)"
        Write-Host "Unused: $($unusedGlobals.Count)"
        Write-Host "First 120 Unused: $($($unusedGlobals | Select-Object -First 120) -join ', ')"
        Write-Host ""

        # 3. Prefix Buckets
        $prefixes = @('order-', 'barista-', 'loyalty-', 'promo-', 'review-', 'skeleton-', 'modal-', 'toast-', 'admin-')
        $buckets = @{}
        foreach ($p in $prefixes) { $buckets[$p] = 0 }
        $buckets['uncategorized'] = 0

        foreach ($cls in $globalClasses) {
            $matched = $false
            foreach ($p in $prefixes) {
                if ($cls.StartsWith($p)) {
                    $buckets[$p]++
                    $matched = $true
                    break
                }
            }
            if (-not $matched) { $buckets['uncategorized']++ }
        }

        Write-Host "--- PREFIX BUCKETS (Globals) ---"
        foreach ($key in $buckets.Keys | Sort-Object) {
            Write-Host "$key: $($buckets[$key])"
        }
    }
}

Analyze-CSSClasses -globalsPath "app/globals.css" -modulePath "app/order/KioskOrderPage.module.css" -tsxPath "app/order/KioskOrderPage.tsx" -searchDir "app"
