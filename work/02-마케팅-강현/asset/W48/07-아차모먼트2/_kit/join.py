# 브라우저에서 받은 C번호:…:END 조각 파일들을 이어 붙여 디코드하고 SHA-256 을 찍는다. 사용: python3 join.py 출력파일 조각1.txt 조각2.txt …
import sys,json,re,base64,hashlib
out=sys.argv[1]; files=sys.argv[2:]
parts={}
for f in files:
    t=open(f).read()
    try:
        d=json.loads(t); t=''.join(x.get('text','') for x in d) if isinstance(d,list) else t
    except Exception: pass
    for m in re.finditer(r'C(\d+):([A-Za-z0-9+/=]*):END',t): parts[int(m.group(1))]=m.group(2)
b=base64.b64decode(''.join(parts[k] for k in sorted(parts)))
open(out,'wb').write(b); print(sorted(parts), len(b), hashlib.sha256(b).hexdigest())
