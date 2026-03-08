import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = 3000;

// Cookieの解析を有効化
app.use(cookieParser());

// 認証設定
const SECRET_KEY = process.env.SECRET_KEY;
const COOKIE_NAME = 'sso_token';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 1日（ミリ秒）
const DOMAIN = '.localhost'; // 本番では '.yourdomain.com'

// 1. ログイン処理（イントラサイト）
app.get('/login', (req: any, res: any) => {
  // ユーザー情報(ペイロード)
  const payload = {
    userId: 'user_123',
    role: 'user'
  };

  // 署名付きトークンの生成（24時間有効）
  const token = jwt.sign(payload, SECRET_KEY, {expiresIn: '24h'});

  // 本来はここでID/PW検証
  res.cookie(COOKIE_NAME, token, {
    domain: DOMAIN,
    path: '/',
    maxAge: SESSION_DURATION,
    httpOnly: true, // XSS対策
    secure: false,  // ローカル開発(http)なのでfalse。本番はtrue。
    sameSite: 'lax'
  });
  
  res.send('ログイン完了！1日間有効なTokenをCookieに保存しました。');
});

const authenticate = (req: any, res: any, next:any)=> {
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    return res.status(401).send('未認証です。ログインしてください。');
  }
  try {
    // 署名の検証（改ざんされていたらここでエラーになる）
    const decoded = jwt.verify(token, SECRET_KEY, {algorithms: ['HS256']});
    req.user = decoded; // 後続の処理でユーザー情報を使えるようにする
    next();
  } catch {
    res.clearCookie(COOKIE_NAME, {domain: DOMAIN, path: '/'});
    return res.status(403).send('認証エラー：トークンが無効か期限切れです。'); 
  }

};

// 2. 認証チェック（他のサイトでも共通して使うロジック）
app.get('/check-auth', authenticate, (req: any, res: any) => {
  res.send(`認証済みです。UserID: ${req.user.userId}`);
});

// 3. ログアウト
app.get('/logout', (req: any, res: any) => {
  res.clearCookie(COOKIE_NAME, { domain: DOMAIN, path: '/' });
  res.send('ログアウトしました。');
});

app.listen(PORT, () => {
  console.log(`SSO Auth Server running at http://localhost:${PORT}`);
});
