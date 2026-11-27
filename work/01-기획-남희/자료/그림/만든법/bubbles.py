# 장면 그림의 빈 말풍선에 글자를 얹는다 (그림 생성기는 한글을 깨뜨리기 쉬워 글자는 따로 넣는다)
# 원본: out/_notext/<id>.png → 결과: out/<id>.png
from PIL import Image, ImageDraw, ImageFont
FONT = r"C:\Users\pc\mp-assets\fonts\BM-JUA-Regular.ttf"   # 배달의민족 주아(OFL)
B = {
    # id: [(중심 x, 중심 y, 칸 너비, 칸 높이, 글)] — 1536×1024 기준
    "d01-day": [(898, 112, 140, 88, "아반떼\n앞범퍼 하나요!"), (1388, 94, 150, 90, "쏘렌토 패드\n두 세트요"), (1440, 272, 100, 70, "급해요!")],
    "s01-rush": [(432, 272, 190, 120, "휀다 좌측\n하나요!"), (1082, 292, 180, 120, "언제\n와요?"), (1386, 514, 170, 115, "따르릉\n따르릉")],
    "s02-dispute": [(745, 185, 215, 120, "하나만\n시켰다니까요?!")],
}
for sid, items in B.items():
    im = Image.open(f"out/_notext/{sid}.png").convert("RGB")
    d = ImageDraw.Draw(im)
    for cx, cy, w, h, text in items:
        size = 60
        while size > 18:
            f = ImageFont.truetype(FONT, size)
            box = d.multiline_textbbox((0, 0), text, font=f, spacing=6, align="center")
            if box[2] - box[0] <= w and box[3] - box[1] <= h:
                break
            size -= 2
        tw, th = box[2] - box[0], box[3] - box[1]
        d.multiline_text((cx - tw / 2 - box[0], cy - th / 2 - box[1]), text, font=f, fill=(35, 57, 91), spacing=6, align="center")
    im.save(f"out/{sid}.png")
    print(sid, "ok")
