# 장면 그림 주문서 만들기 + codex exec 로 N장씩 줄 세워 그리기
# 쓰는 법: python scenes.py briefs        → briefs/<id>.txt
#          python scenes.py run 4 [id..]  → out/<id>.png (이미 있으면 건너뜀)
import json, subprocess, sys, os, time, threading
from pathlib import Path

HERE = Path(__file__).resolve().parent
CODEX = r"C:\Users\pc\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe"

STYLE = """STYLE: warm, friendly 2D digital illustration in the style of a modern Korean webtoon / editorial illustration — exactly the same drawing style, line weight, shading and palette as the character sheet ref/char-sheet.png. Clean confident line art, soft cel shading, gentle gradients. Palette: deep teal #1E6E6E, warm orange #F28C28, navy #23395B, warm grays and warm whites. Landscape 3:2, one single panel (not a comic strip unless the brief says panels)."""

WORLD = """WORLD: a small Korean auto-parts dealership (sells genuine car parts to repair shops). The parts counter office: a long counter desk with a desktop PC monitor, a desk phone with several line buttons, a cordless phone, piles of yellow sticky notes and a spiral memo pad; behind the glass window, tall metal shelves with brown and white parts boxes (bumpers, filters, brake pads). The repair shop: a small garage with a car lifted on a two-post lift, tool cabinets, tires."""

CHARS = {
    "PARK": "PARK — the 61-year-old order clerk (salt-and-pepper short hair, rimless reading glasses low on the nose, light blue shirt, navy quilted vest with a pen in the pocket, single-ear headset)",
    "KIM": "KIM — the 48-year-old repair-shop owner (short black hair, stubble, charcoal coverall tied at the waist over a white T-shirt with an orange stripe, gray towel on the shoulder)",
    "LEE": "LEE — the 34-year-old delivery and shipping staff (black low ponytail, navy cap without logo, orange-and-navy windbreaker, cargo pants)",
}

RULES = """RULES:
- Match the character sheet exactly for every person who appears (same face, hair, glasses, outfit, colours, body type). Only the listed characters appear as main figures.
- Every person has exactly two arms and two hands with five fingers each.
- NO readable text anywhere: no letters, words, numbers, Korean or English, no captions, no speech-bubble text, no logos or brand marks (no car or parts company logos). On screens, cards, papers and labels use simple flat UI shapes: rounded rectangles, short gray bars for text lines, small coloured chips, simple icons (car silhouette, bumper shape, play triangle, magnifying glass, check mark, waveform). Speech is shown as empty speech bubbles or small icons only.
- Screens show a clean modern app UI in teal/white with large elements (the user is older), as described in the brief.
- Opaque background, no transparency."""

SCENES = [
    ("s00-cover", ["PARK", "KIM", "LEE"], "Cover illustration. Center: PARK at the parts counter wearing his headset, smiling with relief, looking at a large tablet that shows a clean order card (car silhouette icon, bumper icon, '2' as two dots, a green check). On the left in a soft round inset bubble, KIM in his garage talking on his phone, sound-wave lines flowing from his phone toward PARK's screen and turning into neat text bars. On the right, LEE holding a parts box giving a thumbs-up. Warm morning light. Calm, hopeful, uncluttered composition with empty space at the top for a title (leave the top 25% as plain warm-white background)."),
    ("s01-rush", ["PARK"], "The problem: a hectic morning at the parts counter. PARK holds the cordless phone to one ear while the desk phone's line buttons blink red; he scribbles on a memo pad; yellow sticky notes are stuck all over the monitor edge and some fall to the floor; a clock on the wall shows a little after 9 (hands only, no numbers). His face is stressed and sweaty. Behind the glass, shelves of parts boxes. Show motion lines and three empty speech bubbles popping from the phones."),
    ("s02-dispute", ["PARK", "KIM"], "The dispute. Split panel (two panels side by side with a thin white gutter). LEFT: KIM in his garage next to a lifted car, holding up ONE finger and frowning, talking on the phone, a single brand-new front bumper leaning on the wall. RIGHT: PARK at the counter, puzzled, flipping through a messy memo pad with crossed-out scribbles, holding up TWO fingers uncertainly, sweat drop. Between them a jagged lightning-shaped empty speech bubble showing conflict."),
    ("f01-upload", ["PARK"], "Feature: uploading call recordings. PARK at his PC, using the mouse to drag a few audio-file icons (rounded squares with a small waveform) from a folder window into a big dashed drop zone on a clean teal-and-white web app; small arrows show the files flying up into a cloud icon. A tiny progress ring next to each file. PARK looks curious and relaxed. Close-medium shot over his shoulder so the screen is large and readable as shapes."),
    ("f02-transcript", ["PARK"], "Feature: reading the call as text. Close shot of PARK, reading glasses on, reading a large monitor that shows a chat-like transcript: alternating rows of gray text bars, each row with a small time chip on the left, and an audio waveform bar with a play button at the top; one row is softly highlighted. On the desk, a pair of headphones set aside. PARK looks relieved and nods. A small side panel on the screen shows a green dot (worker online)."),
    ("f03-live", ["PARK", "KIM"], "Feature: live transcription demo. Diagonal composition: KIM on the left in his garage speaking into his phone (empty speech bubbles with sound waves); the sound waves travel across the image as a ribbon and turn into lines of text bars appearing one by one on a tablet held by PARK on the right; next to the text an order card is filling in (car icon slot filled, part icon slot filled, quantity dots, an orange 'urgent' flame chip). A small microphone icon glows on the tablet. Energetic, magical-but-clean feeling."),
    ("f04-card", ["PARK"], "Feature: the AI order card. A large clean UI card floats in front of PARK as the hero of the image: rows with icons — a storefront icon (customer), a car silhouette (model and year), a license-plate shaped empty chip, a list of two part rows (bumper icon with two dots for quantity, oil-filter icon with a stack of dots), an orange flame chip for urgent, a truck icon for delivery, and a yellow question-mark chip for 'ask again'. Thin glowing lines connect each row back to highlighted lines in a transcript panel behind it. PARK points at the card approvingly. A small sparkle icon marks it as an AI draft."),
    ("f05-evidence", ["PARK", "KIM"], "Feature: evidence and 'listen again'. PARK at the counter taps the quantity row of an order card on his monitor; the matching sentence in the transcript lights up in yellow and a speaker icon emits sound waves; a play-head line sits on an audio waveform. In a round inset in the corner, KIM on the phone scratching his head, embarrassed but smiling, as if saying 'oh right, I did say two'. A yellow 'listen' badge with a headphone icon is shown next to a license-plate chip on the card."),
    ("f06-confirm", ["PARK", "LEE"], "Feature: edit and confirm. Left: PARK presses a big green confirm button with a check mark on a touchscreen monitor; a card slides from a column of yellow 'needs check' cards into a column of green 'confirmed' cards (kanban-like with three columns: yellow, green, blue truck). Right: LEE in the stockroom receives the confirmed card on her rugged tablet, picking a bumper box from a shelf. A dotted arrow connects PARK's screen to LEE's tablet."),
    ("f07-glossary", ["PARK"], "Feature: the shop-talk dictionary. PARK sits with a small open notebook-like screen panel showing a two-column table of pairs: on the left a rough hand-drawn doodle of a car part, an arrow, on the right the clean icon of the same part (e.g., a fender, a shock absorber, a radiator) — three such rows, no text. Above, a microphone icon and a sparkle icon both point into the notebook to show it is used by both speech recognition and the AI. PARK adds a new row with a plus button, looking proud like a teacher."),
    ("f08-search", ["PARK"], "Feature: finding a past call. PARK holds a large magnifying glass over a long horizontal timeline of call cards stretching into the distance (each card a rounded rectangle with a phone icon, a small car icon and gray text bars); under the glass, one card is enlarged and highlighted with a bold yellow marker on one line. A search bar with a magnifying-glass icon and filter chips (calendar, storefront, status dot) floats at the top. PARK looks pleased, 'found it'."),
    ("f09-ask", ["PARK"], "Feature: asking questions about past calls. PARK talks to a friendly chat panel on his monitor: his message is a gray bubble (text bars only), the assistant's answer is a teal bubble with text bars, and attached under it are two small 'evidence' chips — each a mini call card with a calendar icon, a clock icon and a play button, connected to a quoted, highlighted transcript line. A small sparkle avatar marks the assistant. PARK leans in with his reading glasses, impressed."),
    ("f10-brief", ["PARK", "LEE"], "Feature: today's briefing. Late afternoon, warm sunset light through the window. PARK and LEE stand side by side in front of a large wall monitor showing a clean dashboard: four big number tiles (shown only as big dot clusters and icons: phone, card, yellow warning, orange flame), a list of 'call back' items each with a phone icon and a yellow question chip, and a small paragraph block of text bars with a copy icon. PARK holds his phone ready to paste the summary into a messenger (a generic chat app, no logo). LEE checks her clipboard of deliveries. Relaxed end-of-day mood, the counter is tidy, no sticky notes."),
]


def brief(sid, chars, scene):
    who = "\n".join("- " + CHARS[c] for c in chars)
    return f"""Generate ONE image with your built-in image generation tool and save it. Do not write code or scripts to draw anything.
1. Look at the reference file ref/char-sheet.png (the character design sheet; it is the style and character reference).
2. Call the image generation tool once, passing that reference and the brief below.
3. Save (or copy) the result as a PNG to out/{sid}.png in the working folder. Create no other files and change nothing else.
4. Answer with one line: saved out/{sid}.png and its pixel size.

BRIEF — illustration {sid} for a product-planning document about an AI that transcribes phone orders at a Korean auto-parts dealership.

{STYLE}

{WORLD}

CHARACTERS IN THIS IMAGE (match ref/char-sheet.png exactly):
{who}

SCENE: {scene}

{RULES}
"""


def write_briefs():
    (HERE / "briefs").mkdir(exist_ok=True)
    for sid, chars, scene in SCENES:
        (HERE / "briefs" / f"{sid}.txt").write_text(brief(sid, chars, scene), encoding="utf-8")
    print(len(SCENES), "briefs")


def run(n, ids):
    todo = [s for s, _, _ in SCENES if (not ids or s in ids)]
    todo = [s for s in todo if not (HERE / "out" / f"{s}.png").exists()]
    lock = threading.Lock()

    def one(sid):
        t = time.time()
        prompt = (HERE / "briefs" / f"{sid}.txt").read_text(encoding="utf-8")
        for attempt in range(2):
            try:
                p = subprocess.run([CODEX, "exec", "--skip-git-repo-check", "-m", "gpt-5.6-sol", "-c", "model_reasoning_effort=low", "--sandbox", "workspace-write", "-"],
                                   input=prompt.encode("utf-8"), cwd=HERE, capture_output=True, timeout=600)
                tail = (p.stdout + p.stderr).decode("utf-8", "replace")[-200:].replace("\n", " ")
            except subprocess.TimeoutExpired:
                tail = "timeout"
            f = HERE / "out" / f"{sid}.png"
            if f.exists() and f.stat().st_mtime >= t - 2 and f.stat().st_size > 50_000:
                with lock:
                    print(f"done {sid} {int(time.time()-t)}s", flush=True)
                return
            with lock:
                print(f"fail {sid} try{attempt+1} {tail}", flush=True)

    threads = []
    while todo or threads:
        threads = [th for th in threads if th.is_alive()]
        while todo and len(threads) < n:
            sid = todo.pop(0)
            th = threading.Thread(target=one, args=(sid,))
            th.start(); threads.append(th)
            time.sleep(3)
        time.sleep(2)
    print("all finished", flush=True)


if __name__ == "__main__":
    if sys.argv[1] == "briefs":
        write_briefs()
    else:
        run(int(sys.argv[2]), sys.argv[3:])
