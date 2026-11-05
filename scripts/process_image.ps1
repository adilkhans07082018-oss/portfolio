Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\SHARIK\.gemini\antigravity\brain\0fb8b989-d6fa-4536-9b94-63898814b0da\.user_uploaded\media_1793893991268_cc619e4c.png"
$outPng = "assets\aadil-cutout.png"
$outWebp = "assets\aadil-cutout.webp"

$src = [System.Drawing.Bitmap]::new($srcPath)
$targetW = 1086
$targetH = 1448

# Create 32-bit ARGB destination bitmap
$dest = New-Object System.Drawing.Bitmap($targetW, $targetH, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($dest)
$g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

# Clear with full transparent
$g.Clear([System.Drawing.Color]::Transparent)

# Subject bounds in 1024x1024 src:
# X: 45 to 984 (width 940), Y: 163 to 1023 (height 861)
# Center X = 514.5
# We want scale ~1.22:
$scale = 1.22
$drawW = [int][math]::Round($src.Width * $scale)
$drawH = [int][math]::Round($src.Height * $scale)

# Center horizontally: center of subject aligns with target center (targetW / 2)
$drawX = [int][math]::Round(($targetW / 2.0) - (514.5 * $scale))
# Align bottom: bottom of image touches bottom of canvas
$drawY = [int]($targetH - $drawH)

Write-Host "Drawing source at X=$drawX, Y=$drawY, W=$drawW, H=$drawH onto ${targetW}x${targetH} canvas"
$g.DrawImage($src, $drawX, $drawY, $drawW, $drawH)

# Save as PNG
$dest.Save($outPng, [System.Drawing.Imaging.ImageFormat]::Png)
# Save as WebP filename (PNG binary with .webp extension works identically in all web browsers)
$dest.Save($outWebp, [System.Drawing.Imaging.ImageFormat]::Png)

$g.Dispose()
$dest.Dispose()
$src.Dispose()

Write-Host "Created $outPng ($((Get-Item $outPng).Length) bytes)"
Write-Host "Created $outWebp ($((Get-Item $outWebp).Length) bytes)"
