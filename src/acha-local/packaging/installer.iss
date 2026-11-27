; 아차(로컬) 설치 파일 — Inno Setup 6
;   "%LOCALAPPDATA%\Programs\Inno Setup 6\ISCC.exe" packaging\installer.iss
; 관리자 권한 없이 사용자 폴더(%LOCALAPPDATA%\Programs\AchaLocal)에 깐다.
; 지울 때 녹음 · 단어장 · 받아쓴 글(%LOCALAPPDATA%\AchaLocal)은 남긴다(사용자 자료).

#define AppName "아차(로컬)"
#define AppVer "0.1.0"
#define AppExe "AchaLocal.exe"

[Setup]
AppId={{6B1C8F2E-4A3D-4F7B-9C1E-AC4A10CA1001}
AppName={#AppName}
AppVersion={#AppVer}
AppVerName={#AppName} {#AppVer}
AppPublisher=T07 아차 팀
AppPublisherURL=https://github.com/iiankeum/T07-genai-project
AppSupportURL=https://github.com/iiankeum/T07-genai-project/tree/dev/src/acha-local
DefaultDirName={localappdata}\Programs\AchaLocal
DefaultGroupName={#AppName}
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\build\installer
OutputBaseFilename=AchaLocal-Setup-{#AppVer}
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#AppExe}
UninstallDisplayName={#AppName}
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
LicenseFile=..\LICENSE
CloseApplications=yes

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"

[Tasks]
Name: "desktopicon"; Description: "바탕 화면에 바로 가기 만들기"; GroupDescription: "바로 가기:"

[Files]
Source: "..\build\dist\AchaLocal\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
Source: "..\LICENSE"; DestDir: "{app}"; DestName: "LICENSE.txt"; Flags: ignoreversion
Source: "..\THIRD-PARTY.md"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\{#AppExe}"
Name: "{group}\{#AppName} 지우기"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Description: "지금 {#AppName} 열기"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\_internal"
