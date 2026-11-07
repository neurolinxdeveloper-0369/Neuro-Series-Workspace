Add-Type -AssemblyName System.Drawing

$logoPath = "A:\smart_home_workspace\public\logo_black.png"
$logoBytes = [System.IO.File]::ReadAllBytes($logoPath)
$ms = New-Object System.IO.MemoryStream($logoBytes, $false)
$logoImg = [System.Drawing.Image]::FromStream($ms)

function Save-ImageSafely($bmp, $targetPath) {
    $tmp = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), [System.Guid]::NewGuid().ToString() + ".png")
    $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
    Move-Item -Force $tmp $targetPath
}

# 1. Android Adaptive Foregrounds (transparent background, logo in safe zone ~60% size)
$foregrounds = @(
    @{ Path = "android\app\src\main\res\mipmap-mdpi\ic_launcher_foreground.png"; Size = 108 },
    @{ Path = "android\app\src\main\res\mipmap-hdpi\ic_launcher_foreground.png"; Size = 162 },
    @{ Path = "android\app\src\main\res\mipmap-xhdpi\ic_launcher_foreground.png"; Size = 216 },
    @{ Path = "android\app\src\main\res\mipmap-xxhdpi\ic_launcher_foreground.png"; Size = 324 },
    @{ Path = "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_foreground.png"; Size = 432 }
)

foreach ($fg in $foregrounds) {
    $size = [int]$fg.Size
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    $logoSize = [int]($size * 0.62)
    $x = [int](($size - $logoSize) / 2)
    $y = [int](($size - $logoSize) / 2)

    $g.DrawImage($logoImg, $x, $y, $logoSize, $logoSize)
    $g.Dispose()

    $fullPath = Join-Path "A:\smart_home_workspace" $fg.Path
    Save-ImageSafely $bmp $fullPath
    $bmp.Dispose()
    Write-Host "Created Foreground: $($fg.Path)"
}

# 2. Android Standard Launcher Icons (white rounded rect background, logo ~70% size)
$launchers = @(
    @{ Path = "android\app\src\main\res\mipmap-mdpi\ic_launcher.png"; Size = 48 },
    @{ Path = "android\app\src\main\res\mipmap-hdpi\ic_launcher.png"; Size = 72 },
    @{ Path = "android\app\src\main\res\mipmap-xhdpi\ic_launcher.png"; Size = 96 },
    @{ Path = "android\app\src\main\res\mipmap-xxhdpi\ic_launcher.png"; Size = 144 },
    @{ Path = "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher.png"; Size = 192 }
)

foreach ($l in $launchers) {
    $size = [int]$l.Size
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::White)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    $logoSize = [int]($size * 0.72)
    $x = [int](($size - $logoSize) / 2)
    $y = [int](($size - $logoSize) / 2)

    $g.DrawImage($logoImg, $x, $y, $logoSize, $logoSize)
    $g.Dispose()

    $fullPath = Join-Path "A:\smart_home_workspace" $l.Path
    Save-ImageSafely $bmp $fullPath
    $bmp.Dispose()
    Write-Host "Created Launcher: $($l.Path)"
}

# 3. Android Round Launcher Icons (white circle clip background, logo ~66% size)
$roundLaunchers = @(
    @{ Path = "android\app\src\main\res\mipmap-mdpi\ic_launcher_round.png"; Size = 48 },
    @{ Path = "android\app\src\main\res\mipmap-hdpi\ic_launcher_round.png"; Size = 72 },
    @{ Path = "android\app\src\main\res\mipmap-xhdpi\ic_launcher_round.png"; Size = 96 },
    @{ Path = "android\app\src\main\res\mipmap-xxhdpi\ic_launcher_round.png"; Size = 144 },
    @{ Path = "android\app\src\main\res\mipmap-xxxhdpi\ic_launcher_round.png"; Size = 192 }
)

foreach ($r in $roundLaunchers) {
    $size = [int]$r.Size
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

    $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillEllipse($brush, 0, 0, $size, $size)
    $brush.Dispose()

    $logoSize = [int]($size * 0.66)
    $x = [int](($size - $logoSize) / 2)
    $y = [int](($size - $logoSize) / 2)

    $g.DrawImage($logoImg, $x, $y, $logoSize, $logoSize)
    $g.Dispose()

    $fullPath = Join-Path "A:\smart_home_workspace" $r.Path
    Save-ImageSafely $bmp $fullPath
    $bmp.Dispose()
    Write-Host "Created Round Launcher: $($r.Path)"
}

# 4. iOS Universal App Icon (1024x1024, solid white background, centered logo ~620x620)
$iosPath = "A:\smart_home_workspace\ios\App\App\Assets.xcassets\AppIcon.appiconset\AppIcon-512@2x.png"
$iosBmp = New-Object System.Drawing.Bitmap 1024, 1024
$iosG = [System.Drawing.Graphics]::FromImage($iosBmp)
$iosG.Clear([System.Drawing.Color]::White)
$iosG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$iosG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality

$iosLogoSize = 620
$iosX = [int]((1024 - $iosLogoSize) / 2)
$iosY = [int]((1024 - $iosLogoSize) / 2)

$iosG.DrawImage($logoImg, $iosX, $iosY, $iosLogoSize, $iosLogoSize)
$iosG.Dispose()

Save-ImageSafely $iosBmp $iosPath
$iosBmp.Dispose()
Write-Host "Created iOS App Icon: 1024x1024"

$logoImg.Dispose()
$ms.Dispose()
Write-Host "ALL_APP_ICONS_GENERATED_SUCCESSFULLY"
