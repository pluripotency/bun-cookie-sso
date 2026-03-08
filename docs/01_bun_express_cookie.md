イントラサイトで認証し、ログインが完了したあといくつかの別のサイトで認証済みでアクセスする、一日はCookieでログイン状態がキープされる最小のexpress.jsアプリをbunで作成する例を教えて


Bunの高速なランタイムを活かし、Expressで**シングルサインオン（SSO）の最小構成**を実装しましょう。

このケースでは、**「親ドメインで発行したCookieを子ドメイン（別のサイト）と共有する」**仕組みが必要です。

### 構成のポイント

* **Domain属性**: Cookieを `.example.com` のように設定することで、`app1.example.com` と `app2.example.com` の両方で認証状態を共有します。
* **httpOnly & Secure**: セキュリティの基本として、JSからのアクセスを禁止し、HTTPSを必須にします（ローカルテスト時はSecureを外します）。
* **maxAge**: 1日（24時間）に設定します。

---

### 1. プロジェクトの準備

まず、ディレクトリを作成して必要なパッケージをインストールします。

```bash
mkdir bun-sso-app
cd bun-sso-app
bun init -y
bun add express cookie-parser

```

### 2. 最小構成のコード（index.ts）

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';

const app = express();
const PORT = 3000;

// Cookieの解析を有効化
app.use(cookieParser());

// 認証設定
const COOKIE_NAME = 'sso_token';
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 1日（ミリ秒）
const DOMAIN = '.localhost'; // 本番では '.yourdomain.com'

// 1. ログイン処理（イントラサイト）
app.get('/login', (req, res) => {
  // 本来はここでID/PW検証
  res.cookie(COOKIE_NAME, 'user_authenticated_id_123', {
    domain: DOMAIN,
    path: '/',
    maxAge: SESSION_DURATION,
    httpOnly: true, // XSS対策
    secure: false,  // ローカル開発(http)なのでfalse。本番はtrue。
    sameSite: 'lax'
  });
  
  res.send('ログイン完了！1日間有効なCookieを発行しました。');
});

// 2. 認証チェック（他のサイトでも共通して使うロジック）
app.get('/check-auth', (req, res) => {
  const token = req.cookies[COOKIE_NAME];
  
  if (token) {
    res.send(`認証済みです。トークン: ${token}`);
  } else {
    res.status(401).send('未認証です。ログインしてください。');
  }
});

// 3. ログアウト
app.get('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { domain: DOMAIN, path: '/' });
  res.send('ログアウトしました。');
});

app.listen(PORT, () => {
  console.log(`SSO Auth Server running at http://localhost:${PORT}`);
});

```

### 3. 実行方法

```bash
bun index.ts

```

---

### 運用のヒント

* **ドメインの注意点**:
ブラウザの仕様上、`localhost` だけではサブドメイン間のCookie共有が正しく動作しないことがあります。テスト時は `/etc/hosts` ファイルを編集して、`app1.test.local` や `app2.test.local` のように別名を付けてテストすることをお勧めします。
* **JWTの活用**:
上記の例では単純な文字列をCookieに入れていますが、実運用では `jsonwebtoken` ライブラリを使用して、署名付きのトークン（JWT）を保存するのが一般的です。

この構成をベースに、特定のパスへのアクセス制限（ミドルウェア）を追加していくのがスムーズです。

次は、この認証情報を利用して特定のページへのアクセスを制限する「認証ミドルウェア」の実装例を作成しましょうか？
