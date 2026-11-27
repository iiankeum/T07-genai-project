# 아차(로컬) 설치 파일 만들기 — 저장소 뿌리에서:  powershell -ExecutionPolicy Bypass -File packaging\build.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
& .\.venv\Scripts\python.exe -m unittest discover -s tests
if ($LASTEXITCODE -ne 0) { throw '검사 실패' }
& .\.venv\Scripts\pyinstaller.exe packaging\glossary-stt.spec --noconfirm --distpath build\dist --workpath build\work
if ($LASTEXITCODE -ne 0) { throw 'PyInstaller 실패' }
$iscc = @("$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe", "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) { throw 'Inno Setup 6 이 없습니다: winget install JRSoftware.InnoSetup' }
& $iscc packaging\installer.iss
if ($LASTEXITCODE -ne 0) { throw 'Inno Setup 실패' }
Get-ChildItem build\installer\*.exe | ForEach-Object { '{0}  {1:N1} MB' -f $_.FullName, ($_.Length / 1MB) }
