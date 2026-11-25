# PyInstaller 설정 — 설치본에 들어갈 프로그램 폴더(dist\GlossarySTT)를 만든다.
#   .venv\Scripts\pyinstaller packaging\glossary-stt.spec --noconfirm --distpath build\dist --workpath build\work
# 그래픽카드 가속 DLL(nvidia-*)은 1GB 가 넘어서 넣지 않는다. 따로 「GPU 팩」으로 만든다(build.ps1).
import os
from PyInstaller.utils.hooks import collect_data_files, collect_dynamic_libs, collect_submodules

ROOT = os.path.abspath(os.path.join(SPECPATH, ".."))

datas = [
    (os.path.join(ROOT, "app", "web"), "app/web"),
    (os.path.join(ROOT, "glossary_stt", "examples"), "glossary_stt/examples"),
]
for name in ("가짜-부품주문-전화", "가짜-AI수업-강의"):
    src = os.path.join(ROOT, "samples", name)
    for f in ("audio.wav", "reference.txt"):
        datas.append((os.path.join(src, f), f"samples/{name}"))
datas += collect_data_files("faster_whisper")
datas += collect_data_files("ctranslate2")
binaries = collect_dynamic_libs("ctranslate2")
hiddenimports = collect_submodules("faster_whisper") + ["app.server"]

a = Analysis(
    [os.path.join(ROOT, "app", "main.py")],
    pathex=[ROOT],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    excludes=["nvidia", "tkinter", "matplotlib", "IPython", "edge_tts", "PyInstaller", "PIL", "pytest"],
    noarchive=False,
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz, a.scripts, [],
    exclude_binaries=True,
    name="AchaLocal",
    console=False,
    icon=os.path.join(ROOT, "packaging", "icon.ico"),
    version=os.path.join(ROOT, "packaging", "version.txt"),
)
coll = COLLECT(exe, a.binaries, a.datas, name="AchaLocal")
