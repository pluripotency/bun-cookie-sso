import { serve } from "bun";
import jwt from 'jsonwebtoken';

// 認証設定
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.SECRET_KEY || 'secret-54321';
const COOKIE_NAME = 'sso_token';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 1日（ミリ秒）
const DOMAIN = '.localhost'; // 本番では '.yourdomain.com'

// ユーザー情報(ペイロード)
const payload = {
  userId: process.env.USER_ID || 'user-54321',
  role: 'user'
};

const login = async (req: Request, next)=>{
  if (req.cookies.get(COOKIE_NAME)){
    return new Response('すでにログインしています。');
  }
  // 署名付きトークンの生成（24時間有効）
  const token = jwt.sign(payload, SECRET_KEY, {expiresIn: '24h'});
  // 本来はここでID/PW検証
  req.cookies.set(COOKIE_NAME, token, {
    domain: DOMAIN,
    path: '/',
    maxAge: SESSION_DURATION,
    httpOnly: true, // XSS対策
    secure: false,  // ローカル開発(http)なのでfalse。本番はtrue。
    sameSite: 'lax'
  });
  return next(true);
};

const authenticate = async (req: Request, next)=>{
  const token = req.cookies.get(COOKIE_NAME);
  if (!token) {
    return new Response('未認証です。ログインしてください。', {status: 401});
  }
  try {
    // 署名の検証（改ざんされていたらここでエラーになる）
    const decoded = jwt.verify(token, SECRET_KEY, {algorithms: ['HS256']});
    return next(decoded);
  } catch {
    return new Response('認証エラー：トークンが無効か期限切れです。', {status: 403});
  }
};

const server = serve({
  port: PORT,
  routes: {
    "/login": {
      async GET(req) {
        return await login(req, async (is_login)=>{
          if (is_login){
            return new Response('ログイン完了！1日間有効なTokenをCookieに保存しました。');
          } else {
            return new Response('something wrong in login', {status: 500});
          }
        });
      }
    },
    "/logout": {
      async GET(req) {
        req.cookies.delete(COOKIE_NAME);
        return new Response('ログアウトしました。');
      }
    },
    "/": {
      async GET(req) {
        return await authenticate(req, async (decoded)=>{
          return new Response(`認証済みです。UserID: ${decoded.userId}`);
        });
      }
    }
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`SSO Auth Server running at ${server.url}`);
