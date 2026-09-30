# Builds the Microsoft Store package (MSIX) from the release build of ahd.exe, on Windows after `tauri build`
# (.github/workflows/msix.yml). Unsigned on purpose: the Store signs the packages it distributes. The .msix is for
# uploading in Partner Center, not for downloading: Windows installs only signed MSIX files.
#   pwsh packaging/msix/build-msix.ps1 -Version 0.1.4
param([Parameter(Mandatory = $true)][string]$Version)
$ErrorActionPreference = 'Stop'

$v = $Version.TrimStart('v')
if ($v -notmatch '^\d+\.\d+\.\d+$') { throw "Version must look like 0.1.4, not '$Version'" }
$root = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$work = Join-Path $root 'src-tauri/target/msix'
$stage = Join-Path $work 'package'
$pri = Join-Path $work 'pri'
$out = Join-Path $work "3ahd_${v}_x64.msix"

# Windows SDK tools (installed on GitHub's Windows runners)
$tool = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin\10.*\x64\makeappx.exe' |
  Sort-Object { [version]$_.Directory.Parent.Name } | Select-Object -Last 1
if (-not $tool) { throw 'makeappx.exe not found: the Windows SDK is needed' }
$makeappx = $tool.FullName
$makepri = Join-Path $tool.DirectoryName 'makepri.exe'
Write-Output "Windows SDK tools: $($tool.DirectoryName)"

Remove-Item -Recurse -Force $work -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $stage, $pri | Out-Null

# the files the installers put on disk (tauri.conf.json > bundle > resources), plus the Store images
Copy-Item (Join-Path $root 'src-tauri/target/release/ahd.exe') $stage
Copy-Item -Recurse (Join-Path $root 'assets/adhan') (Join-Path $stage 'adhan')
Copy-Item -Recurse (Join-Path $root 'assets/data') (Join-Path $stage 'data')
Copy-Item -Recurse (Join-Path $root 'src-tauri/icons/tray') (Join-Path $stage 'tray')
Copy-Item -Recurse (Join-Path $root 'packaging/msix/Assets') (Join-Path $stage 'Assets')
$manifest = (Get-Content (Join-Path $root 'packaging/msix/AppxManifest.xml') -Raw).Replace('{VERSION}', "$v.0")
Set-Content (Join-Path $stage 'AppxManifest.xml') $manifest -Encoding utf8NoBOM -NoNewline

# resources.pri lets Windows pick the image size it needs (taskbar and Start sizes, scale-200 on HiDPI screens).
# It is indexed from a folder with only the images, so the app's own files are not taken for resources.
Copy-Item -Recurse (Join-Path $stage 'Assets') (Join-Path $pri 'Assets')
Copy-Item (Join-Path $stage 'AppxManifest.xml') $pri
$priconfig = Join-Path $work 'priconfig.xml'
& $makepri createconfig /cf $priconfig /dq en-US /pv 10.0.0 /o
if ($LASTEXITCODE) { throw "makepri createconfig failed ($LASTEXITCODE)" }
# one resources.pri with every size: the default <packaging> section splits scale-200 into its own file, which is
# meant for bundles of resource packages and is ignored in a single package
[xml]$cfg = Get-Content $priconfig -Raw
$packaging = $cfg.resources.SelectSingleNode('packaging')
if ($packaging) { [void]$cfg.resources.RemoveChild($packaging) }
$cfg.Save($priconfig)
& $makepri new /pr $pri /cf $priconfig /mn (Join-Path $pri 'AppxManifest.xml') /of (Join-Path $stage 'resources.pri') /o
if ($LASTEXITCODE) { throw "makepri new failed ($LASTEXITCODE)" }

& $makeappx pack /d $stage /p $out /o
if ($LASTEXITCODE) { throw "makeappx pack failed ($LASTEXITCODE)" }
Write-Output "MSIX: $out ($([math]::Round((Get-Item $out).Length / 1MB, 1)) MB)"
