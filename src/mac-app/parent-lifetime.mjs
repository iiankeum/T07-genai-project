// stdin은 호출한 앱이 쓰기 쪽을 들고 있는 파이프다. 앱이 강제 종료되어도 서버를 닫는다.
process.umask(0o077);
process.stdin.once('end', () => process.kill(process.pid, 'SIGTERM'));
process.stdin.resume();
