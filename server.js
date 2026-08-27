const express = require('express');
const webpush = require('web-push');
const cron = require('node-cron');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 외부 환경변수 오류를 원천 차단하고 라이브러리 규격에 100% 맞는 VAPID 키 자동 생성
const vapidKeys = webpush.generateVAPIDKeys();

webpush.setVapidDetails(
  'mailto:admin@example.com',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

let subscriptions = [];

// 프론트엔드가 사용할 공개키 반환
app.get('/api/vapid-public-key', (req, res) => {
  res.json({ publicKey: vapidKeys.publicKey });
});

// 알림 구독 등록
app.post('/api/subscribe', (req, res) => {
  const { subscription, time, location } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: '유효하지 않은 구독 정보입니다.' });
  }
  subscriptions = subscriptions.filter(s => s.subscription.endpoint !== subscription.endpoint);
  subscriptions.push({ subscription, time: time || '06:00', location: location || '대구' });
  res.json({ success: true, totalDevices: subscriptions.length });
});

// 수동 테스트 푸시 발송
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

// 매분 정각 시간 체크 후 자동 푸시 발송 (KST 기준)
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
app.listen(PORT, () => {
  console.log(`Push Server running on port ${PORT}`);
});
