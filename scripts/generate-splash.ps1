Add-Type -AssemblyName System.Drawing

$logoPath = "A:\smart_home_workspace\public\logo_black.png"
$logoBytes = [System.IO.File]::ReadAllBytes($logoPath)
$ms = New-Object System.IO.MemoryStream($logoBytes, $false)
$logoImg = [System.Drawing.Image]::FromStream($ms)

$targets = @(
    @{ Path = "android\app\src\main\res\drawable\splash.png"; W = 480; H = 320 },
    @{ Path = "android\app\src\main\res\drawable-land-hdpi\splash.png"; W = 800; H = 480 },
    @{ Path = "android\app\src\main\res\drawable-land-mdpi\splash.png"; W = 480; H = 320 },
    @{ Path = "android\app\src\main\res\drawable-land-xhdpi\splash.png"; W = 1280; H = 720 },
    @{ Path = "android\app\src\main\res\drawable-land-xxhdpi\splash.png"; W = 1600; H = 960 },
    @{ Path = "android\app\src\main\res\drawable-land-xxxhdpi\splash.png"; W = 1920; H = 1280 },
    @{ Path = "android\app\src\main\res\drawable-port-hdpi\splash.png"; W = 480; H = 800 },
    @{ Path = "android\app\src\main\res\drawable-port-mdpi\splash.png"; W = 320; H = 480 },
    @{ Path = "android\app\src\main\res\drawable-port-xhdpi\splash.png"; W = 720; H = 1280 },
    @{ Path = "android\app\src\main\res\drawable-port-xxhdpi\splash.png"; W = 960; H = 1600 },
    @{ Path = "android\app\src\main\res\drawable-port-xxxhdpi\splash.png"; W = 1280; H = 1920 },
    @{ Path = "ios\App\App\Assets.xcassets\Splash.imageset\splash-2732x2732.png"; W = 2732; H = 2732 },
    @{ Path = "ios\App\App\Assets.xcassets\Splash.imageset\splash-2732x2732-1.png"; W = 2732; H = 2732 },
    @{ Path = "ios\App\App\Assets.xcassets\Splash.imageset\splash-2732x2732-2.png"; W = 2732; H = 2732 }
)

foreach ($t in $targets) {
    $full = Join-Path "A:\smart_home_workspace" $t.Path
    $w = [int]$t.W
    $h = [int]$t.H
    
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    $minDim = [Math]::Min($w, $h)
    $size = [Math]::Max(80, [int]($minDim * 0.28))
    if ($size -gt 450) { $size = 450 }
    
    $x = [int](($w - $size) / 2)
    $y = [int](($h - $size) / 2)

    $g.DrawImage($logoImg, $x, $y, $size, $size)
    $g.Dispose()

    $tmp = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.Guid]::NewGuid().ToString() + ".png")
    $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    Move-Item -Force $tmp $full
    Write-Host "Success: $($t.Path)"
}

$logoImg.Dispose()
$ms.Dispose()
Write-Host "ALL_SPLASH_SCREENS_DONE"
