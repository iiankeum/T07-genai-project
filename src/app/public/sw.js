// 홈 화면에 추가(PWA)용 서비스 워커. 아무것도 저장하지 않고 그대로 네트워크로 보낸다(데모 데이터가 늘 최신이게).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* 기본 네트워크 동작 */ });
