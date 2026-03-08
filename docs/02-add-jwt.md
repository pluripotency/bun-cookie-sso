署名付きトークンの実装を追加してください。


署名付きトークン（JWT: JSON Web Token）を導入することで、ユーザーがブラウザ側でCookieの内容（ユーザーIDなど）を勝手に書き換えることを防げるようになります。

Bunには高速なJWTライブラリ `jose` や、定番の `jsonwebtoken` がありますが、今回は最も一般的に使われている `jsonwebtoken` を使用した例を紹介します。

### 1. ライブラリの追加

```bash
bun add jsonwebtoken
bun add -d @types/jsonwebtoken

```

### 2. JWTを組み込んだ実装例

秘密鍵（`SECRET_KEY`）を使って署名を行い、改ざんを検知できるようにします。

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = 3000;

// 本来は環境変数から読み込む
const SECRET_KEY = 'your-super-secret-key-12345';
const COOKIE_NAME = 'sso_token';
const DOMAIN = '.test.local';

app.use(cookieParser());

// 1. ログイン：JWTを発行してCookieにセット
app.get('/login', (req, res) => {
  // ユーザー情報（ペイロード）
  const payload = {
    userId: 'user_123',
    role: 'admin'
  };

  // 署名付きトークンの生成（24時間有効）
  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '24h' });

  res.cookie(COOKIE_NAME, token, {
    domain: DOMAIN,
    path: '/',
    maxAge: 24 * 60 * 60 * 1000,
    httpOnly: true,
    secure: false, // 本番(HTTPS)ではtrue
    sameSite: 'lax'
  });

  res.send('ログイン完了：署名付きトークンを発行しました。');
});

// 2. 認証ミドルウェア：トークンの正当性を検証
const authenticate = (req: any, res: any, next: any) => {
  const token = req.cookies[COOKIE_NAME];

  if (!token) {
    return res.status(401).send('未認証：トークンがありません。');
  }

  try {
    // 署名の検証（改ざんされていたらここでエラーになる）
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded; // 後続の処理でユーザー情報を使えるようにする
    next();
  } catch (err) {
    return res.status(403).send('認証エラー：トークンが無効か期限切れです。');
  }
};

// 3. 保護されたルート（app1, app2共通で使える）
app.get('/check-auth', authenticate, (req: any, res) => {
  res.send(`認証成功！ ログイン中のユーザーID: ${req.user.userId}`);
});

app.listen(PORT, () => {
  console.log(`SSO Server running at http://app1.test.local:${PORT}`);
});

```

---

### この実装のメリット

1. **改ざん防止**:
ユーザーがブラウザのデベロッパーツールで `userId` を `admin` に書き換えても、サーバー側の `SECRET_KEY` で署名が検証されるため、不正なアクセスを即座に拒否できます。
2. **ステートレス（状態を持たない）**:
サーバー側にセッション情報を保存（DBやメモリに記録）する必要がないため、サーバーの負荷が低く、スケールしやすい構成です。
3. **情報の透明性と検証**:
JWTの中身（ペイロード）には有効期限（`exp`）が含まれているため、サーバーはDBに問い合わせることなく「このトークンはまだ有効か？」を判断できます。

### 動作確認のヒント

`app1.test.local:3000/login` でログインした後、`app2.test.local:3000/check-auth` にアクセスしてみてください。どちらのドメインからでも、同じ `SECRET_KEY` を持つサーバーであればユーザーを特定できるようになります。

次は、このトークンを使って「管理者だけが見れるページ」などの**ロール（権限）ベースのアクセス制御**を追加してみますか？
