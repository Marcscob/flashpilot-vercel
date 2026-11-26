# Gera as imagens de teste de visao (GDI+) a partir de assets-spec.json. Uso: powershell -File scripts/eval/make-assets.ps1
Add-Type -AssemblyName System.Drawing
$dir = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $dir "assets"
New-Item -ItemType Directory -Force $out | Out-Null
$spec = [IO.File]::ReadAllText((Join-Path $dir "assets-spec.json"), [Text.Encoding]::UTF8) | ConvertFrom-Json
$rand = New-Object Random 42

function New-Canvas($w, $h, $bgColor) {
  $bmp = New-Object Drawing.Bitmap $w, $h
  $g = [Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"; $g.TextRenderingHint = "AntiAliasGridFit"; $g.InterpolationMode = "HighQualityBicubic"
  $g.Clear([Drawing.ColorTranslator]::FromHtml($bgColor))
  return @($bmp, $g)
}

function Save-Rotated($bmp, $angle, $path, $photo) {
  if ($angle -ne 0 -or $photo) {
    $w = $bmp.Width; $h = $bmp.Height
    $dst = New-Object Drawing.Bitmap $w, $h
    $g = [Drawing.Graphics]::FromImage($dst)
    $g.Clear([Drawing.Color]::FromArgb(70, 64, 58))
    $g.InterpolationMode = "HighQualityBicubic"
    $g.TranslateTransform($w / 2, $h / 2); $g.RotateTransform($angle); $g.TranslateTransform(-$w / 2, -$h / 2)
    $g.DrawImage($bmp, 0, 0, $w, $h)
    $g.ResetTransform()
    if ($photo) {
      $grad = New-Object Drawing.Drawing2D.LinearGradientBrush ([Drawing.Point]::new(0, 0)), ([Drawing.Point]::new($w, $h)), ([Drawing.Color]::FromArgb(110, 0, 0, 0)), ([Drawing.Color]::FromArgb(0, 0, 0, 0))
      $g.FillRectangle($grad, 0, 0, $w, $h)
      for ($i = 0; $i -lt 6000; $i++) {
        $c = $rand.Next(0, 255)
        $brush = New-Object Drawing.SolidBrush ([Drawing.Color]::FromArgb(28, $c, $c, $c))
        $g.FillRectangle($brush, $rand.Next(0, $w), $rand.Next(0, $h), 3, 3); $brush.Dispose()
      }
    }
    $g.Dispose(); $bmp.Dispose(); $bmp = $dst
  }
  $bmp.Save($path, [Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
}

foreach ($img in $spec.images) {
  $bg = "#FFFFFF"; if ($img.lined) { $bg = "#FBF7E6" }
  $c = New-Canvas $img.width $img.height $bg
  $bmp = $c[0]; $g = $c[1]
  $font = New-Object Drawing.Font ($img.font), ([single]$img.size), ([Drawing.FontStyle]::Regular), ([Drawing.GraphicsUnit]::Pixel)
  $black = [Drawing.Brushes]::Black
  if ($img.lined) {
    $pen = New-Object Drawing.Pen ([Drawing.Color]::FromArgb(150, 120, 160, 220)), 1
    for ($y = 70; $y -lt $img.height; $y += 52) { $g.DrawLine($pen, 20, $y, ($img.width - 20), $y) }
  }
  if ($img.kind -eq "table") {
    $cols = @(380, 280, 280); $x0 = 30; $y = 30; $rowH = 80
    foreach ($row in $img.rows) {
      $x = $x0
      for ($i = 0; $i -lt 3; $i++) {
        $g.DrawRectangle([Drawing.Pens]::Black, $x, $y, $cols[$i], $rowH)
        $g.DrawString($row[$i], $font, $black, [single]($x + 12), [single]($y + 22))
        $x += $cols[$i]
      }
      $y += $rowH
    }
  } else {
    $fmt = New-Object Drawing.StringFormat
    if ($img.rtl) { $fmt.FormatFlags = [Drawing.StringFormatFlags]::DirectionRightToLeft }
    $rect = New-Object Drawing.RectangleF 30, 30, ($img.width - 60), ($img.height - 60)
    $lineGap = 0
    $g.DrawString(($img.text -replace "\\n", "`n"), $font, $black, $rect, $fmt)
  }
  $angle = 0; if ($img.rotate) { $angle = [double]$img.rotate }
  $photo = $false; if ($img.photo) { $photo = $true }
  Save-Rotated $bmp $angle (Join-Path $out ($img.id + ".png")) $photo
}

# Diagrama com gabarito de posicoes
$d = $spec.diagram
$c = New-Canvas $d.width $d.height "#FFFFFF"; $bmp = $c[0]; $g = $c[1]
foreach ($s in $d.shapes) {
  $col = [Drawing.ColorTranslator]::FromHtml($s.c); $brush = New-Object Drawing.SolidBrush $col; $pen = New-Object Drawing.Pen $col, 6
  $state = $g.Save()
  if ($s.t -eq "line") { $g.DrawLine($pen, $s.x1, $s.y1, $s.x2, $s.y2) }
  elseif ($s.t -eq "circle") { $g.FillEllipse($brush, ($s.x - $s.r), ($s.y - $s.r), (2 * $s.r), (2 * $s.r)) }
  elseif ($s.t -eq "rect") { $g.FillRectangle($brush, $s.x, $s.y, $s.w, $s.h) }
  else {
    $cx = $s.x + $s.w / 2; $cy = $s.y + $s.h / 2
    if ($s.rotate) { $g.TranslateTransform($cx, $cy); $g.RotateTransform($s.rotate); $g.TranslateTransform(-$cx, -$cy) }
    $g.FillEllipse($brush, $s.x, $s.y, $s.w, $s.h)
  }
  $g.Restore($state)
}
$lf = New-Object Drawing.Font "Segoe UI", ([single]28), ([Drawing.FontStyle]::Bold), ([Drawing.GraphicsUnit]::Pixel)
$apen = New-Object Drawing.Pen ([Drawing.Color]::DimGray), 3
$apen.CustomEndCap = New-Object Drawing.Drawing2D.AdjustableArrowCap 5, 5
foreach ($l in $d.labels) {
  $g.DrawString($l.text, $lf, [Drawing.Brushes]::Black, [single]$l.tx, [single]$l.ty)
  $size = $g.MeasureString($l.text, $lf)
  $sx = $l.tx + $size.Width / 2; $sy = $l.ty + $size.Height
  if ($l.tx -gt $l.ax) { $sx = $l.tx; $sy = $l.ty + $size.Height / 2 } elseif (($l.tx + $size.Width) -lt $l.ax) { $sx = $l.tx + $size.Width; $sy = $l.ty + $size.Height / 2 }
  $g.DrawLine($apen, [single]$sx, [single]$sy, [single]$l.ax, [single]$l.ay)
}
Save-Rotated $bmp 0 (Join-Path $out ($d.id + ".png")) $false
Write-Host "ok" (Get-ChildItem $out).Count
