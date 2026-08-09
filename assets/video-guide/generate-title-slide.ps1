Add-Type -AssemblyName System.Drawing

$outputPath = Join-Path $PSScriptRoot 'slide-01.png'
$width = 1080
$height = 1920

$bitmap = New-Object System.Drawing.Bitmap $width, $height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit

$background = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle 0, 0, $width, $height),
    ([System.Drawing.Color]::FromArgb(255, 11, 22, 48)),
    ([System.Drawing.Color]::FromArgb(255, 10, 16, 36)),
    90
)
$graphics.FillRectangle($background, 0, 0, $width, $height)

$tealBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 139, 233, 253))
$whiteBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 248, 250, 252))
$mutedBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 203, 213, 225))
$panelBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(210, 9, 18, 38))
$panelBorder = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(80, 148, 163, 184)), 3

$eyebrowFont = New-Object System.Drawing.Font('Georgia', 28, [System.Drawing.FontStyle]::Bold)
$titleFont = New-Object System.Drawing.Font('Georgia', 70, [System.Drawing.FontStyle]::Bold)
$bodyFont = New-Object System.Drawing.Font('Georgia', 30, [System.Drawing.FontStyle]::Regular)
$bodyBoldFont = New-Object System.Drawing.Font('Georgia', 30, [System.Drawing.FontStyle]::Bold)
$footerFont = New-Object System.Drawing.Font('Georgia', 24, [System.Drawing.FontStyle]::Regular)

$left = 72
$top = 92
$graphics.DrawString('GMCT CONNECT', $eyebrowFont, $tealBrush, $left, $top)
$graphics.DrawString("How To Start Using`nThe App", $titleFont, $whiteBrush, $left, 160)
$graphics.DrawString('A short mobile guide for first sign in, password change, contributions view, and adding the app to your home screen.', $bodyFont, $mutedBrush, (New-Object System.Drawing.RectangleF($left, 450, 900, 220)))

$panelRect = New-Object System.Drawing.Rectangle 72, 740, 936, 500
$graphics.FillRectangle($panelBrush, $panelRect)
$graphics.DrawRectangle($panelBorder, $panelRect)

$graphics.DrawString('Important:', $bodyBoldFont, $whiteBrush, 112, 790)
$graphics.DrawString('Every member has a class number, and that class number is your ID for signing in. The church admin must add the account first.', $bodyFont, $mutedBrush, (New-Object System.Drawing.RectangleF(112, 840, 840, 160)))
$graphics.DrawString('Example username / ID: 121', $bodyFont, $mutedBrush, 112, 1010)
$graphics.DrawString('First-time password: gmct2026', $bodyFont, $mutedBrush, 112, 1070)
$graphics.DrawString('After sign in, the first login will ask you to change your password.', $bodyFont, $mutedBrush, (New-Object System.Drawing.RectangleF(112, 1140, 840, 110)))

$graphics.DrawString('Follow the next slides step by step.', $footerFont, $tealBrush, 72, 1770)

$bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

$background.Dispose()
$tealBrush.Dispose()
$whiteBrush.Dispose()
$mutedBrush.Dispose()
$panelBrush.Dispose()
$panelBorder.Dispose()
$eyebrowFont.Dispose()
$titleFont.Dispose()
$bodyFont.Dispose()
$bodyBoldFont.Dispose()
$footerFont.Dispose()
$graphics.Dispose()
$bitmap.Dispose()
