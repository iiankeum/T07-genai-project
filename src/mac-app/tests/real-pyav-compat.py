# 가짜 합성 음성만 사용. 기존 패키지는 변경하지 않는다.
import sys,os,json,pathlib,io,argparse
p=argparse.ArgumentParser();p.add_argument("--run-synthetic-model-test",action="store_true",required=True);p.add_argument("--fixtures",type=pathlib.Path,required=True);p.add_argument("--model",type=pathlib.Path,required=True);p.add_argument("--agent-source",type=pathlib.Path,default=pathlib.Path(__file__).resolve().parents[2]/"pc-agent");args=p.parse_args()
if not args.model.is_dir(): raise ValueError("existing local model directory required")
os.environ.update(HF_HUB_OFFLINE='1',HF_HUB_DISABLE_TELEMETRY='1',OMP_NUM_THREADS='4')
sys.path.insert(0,str(args.agent_source))
from callnote_agent import WhisperTranscriber,read_wav_16k_mono
from decode_audio_compat import decode_audio_compat,AudioLimitExceeded
root=args.fixtures;t=WhisperTranscriber(str(args.model),device='cpu');rows=[]
for ext in ['wav','mp3','m4a']:
 p=root/('synthetic.'+ext);a=decode_audio_compat(p);result=t.transcribe(p,None,'ko');assert result['text']=='앞 브레이크 패드 한 세트와 앞 디스크 두 개 부탁합니다.';rows.append({'format':ext,'shape':list(a.shape),'dtype':str(a.dtype),'transcription':result})
stream=io.BytesIO((root/'synthetic.m4a').read_bytes());streamResult=t.transcribe(stream,None,'ko');assert not stream.closed
arrayResult=t.transcribe(read_wav_16k_mono((root/'synthetic.wav').read_bytes()),None,'ko')
try:decode_audio_compat(root/'synthetic.wav',max_seconds=1);raise AssertionError('limit not applied')
except AudioLimitExceeded:bounded=True
print(json.dumps({'syntheticOnly':True,'python':sys.executable,'results':rows,'bytesIO':streamResult,'workerWavContract':arrayResult,'oneSecondLimitRejected':bounded},ensure_ascii=False,indent=2))
