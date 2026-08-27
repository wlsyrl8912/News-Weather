self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || '🌅 [모닝 브리핑]';
  const options = {
    body: data.body || '오늘의 날씨와 뉴스가 도착했습니다.',
    icon: '/icon.png',
    badge: '/icon.png',
    data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
