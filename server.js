const express = require('express');
const webpush = require('web-push');
const cron = require('node-cron');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 공백, 따옴표, 줄바꿈, 끝자리 등호(=)를 자동으로 안전하게 정제
const cleanKey = (key) => (key || '').replace(/["'\s]/g, '').replace(/=+$/, '');

const VAPID_PUBLIC_KEY = cleanKey(process.env.VAPID_PUBLIC_KEY);
const VAPID_PRIVATE_KEY = cleanKey(process.env.VAPID_PRIVATE_KEY);

webpush.setVapidDetails(
  'mailto:admin@example.com',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

let subscriptions = [];

app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/subscribe', (req, res) => {
  const { subscription, time, location } = req.body;
  subscriptions = subscriptions.filter(s => s.subscription.endpoint !== subscription.endpoint);
  subscriptions.push({ subscription, time: time || '06:00', location: location || '대구' });
  res.json({ success: true, totalDevices: subscriptions.length });
});

app.post('/api/send-test-push', async (req, res) => {
  const payload = JSON.stringify({
    title: req.body.title || '🌅 [테스트] 모닝 브리핑',
    body: req.body.body || '스마트폰 상단바 푸시 수신이 정상 작동합니다.',
    url: '/'
  });

  const sendPromises = subscriptions.map(sub => 
    webpush.sendNotification(sub.subscription, payload).catch(err => {
      if (err.statusCode === 404 || err.statusCode === 410) {
        return { expiredEndpoint: sub.subscription.endpoint };
      }
    })
  );

  const results = await Promise.all(sendPromises);
  const expired = results.filter(r => r && r.expiredEndpoint).map(r => r.expiredEndpoint);
  subscriptions = subscriptions.filter(s => !expired.includes(s.subscription.endpoint));

  res.json({ success: true, sentCount: subscriptions.length });
});

cron.schedule('* * * * *', async () => {
  const now = new Date();
  const kstTime = now.toLocaleTimeString('ko-KR', {
    hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul'
  });

  const targets = subscriptions.filter(s => s.time === kstTime);
  if (targets.length === 0) return;

  const payload = JSON.stringify({
    title: `🌅 [${kstTime} 모닝 브리핑]`,
    body: '📌 오늘의 날씨와 4대 핵심 뉴스가 도착했습니다. 탭하여 확인하세요 ➔',
    url: '/'
  });

  targets.forEach(target => {
    webpush.sendNotification(target.subscription, payload).catch(() => {});
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Push Server running on port ${PORT}`));
