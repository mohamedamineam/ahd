# 3ahd website (Cloudflare Pages)

A static, bilingual page (`public/`) with direct downloads, Linux install commands, system requirements, and a
feedback form stored privately in a Cloudflare D1 database (`functions/`). Nothing here uses third-party scripts,
fonts or trackers.

```
website/
  public/            the site (index.html, assets/, _redirects, _headers)
  functions/api/     POST /api/comments — visitors can only send; nothing on the site can read messages back
  lib/util.js        shared helpers for the functions
  comments.mjs       reads the messages on your computer, through your Cloudflare login
  schema.sql         the comments table
  wrangler.toml      Pages project + D1 binding
```

## How downloads work

`public/_redirects` sends `/download/3ahd-windows-x64-setup.exe` (and the .msi, .deb, .rpm, .AppImage, SHA256SUMS)
to `https://github.com/mohamedamineam/ahd/releases/latest/download/…`. The browser downloads the file directly; the
visitor never sees a GitHub page. The release workflow uploads these version-free file names with every release, so
the links always give the newest **published** release. They work once the first release is published on GitHub.

The app was renamed from Ahd to 3ahd after 0.1.2, and the file names changed with it (`Ahd-…` → `3ahd-…`; old links
redirect to the new names). **Publish the first 3ahd release before deploying this version of the website**: until then
the newest release only has the old `Ahd-…` files, so the new download links would fail.

## Deploy (once)

Run these in a terminal, in this `website` folder. You need a free Cloudflare account.

```sh
npx wrangler login                                   # opens the browser to connect your Cloudflare account
npx wrangler d1 create ahd-comments                  # prints a database_id
# put that database_id into wrangler.toml (replace the example id), then:
npx wrangler d1 execute ahd-comments --remote --file=schema.sql
npx wrangler pages project create 3ahd --production-branch main
npx wrangler pages deploy                            # publishes public/ and functions/ → https://3ahd.pages.dev
npx wrangler pages secret put HASH_SALT --project-name 3ahd   # optional: any long random text (salts the spam limit)
```

If the name `ahd` is taken on pages.dev, use another project name (e.g. `ahd-app`) in both commands and in
`wrangler.toml`. A custom domain can be added later in the Cloudflare dashboard (Pages → the project → Custom domains).

To update the site later: `npx wrangler pages deploy`. Browsers keep `assets/` for a week, so after changing `site.css` or `site.js`,
raise the `?v=` number where `index.html` loads them.

## Reading the comments (secure)

The public site can only **receive** messages; there is no page or API that shows them. Only you can read them,
signed in to your Cloudflare account — turn on two-factor authentication in Cloudflare (My Profile → Authentication).

- **Cloudflare dashboard:** Storage & Databases → D1 → `ahd-comments` → Explore Data / Console.
- **On your computer:**
  ```sh
  node comments.mjs            # latest 50 messages
  node comments.mjs --csv      # also saves comments.csv (LibreOffice / Excel)
  node comments.mjs --delete 12
  ```

Each message stores the text, optional name and email, the type, the page language, the visitor's country (from
Cloudflare) and a salted hash used only to allow at most five messages per hour from the same connection. A hidden
spam-trap field and a minimum time on the page stop simple bots.

## Test locally

```sh
npx wrangler d1 execute ahd-comments --local --file=schema.sql
npx wrangler pages dev public --compatibility-date=2026-07-01 --d1 DB=<database_id from wrangler.toml>
# → http://localhost:8788 ; read test messages with: node comments.mjs --local
```

---

<div dir="rtl">

## بالعربية باختصار

- الموقع ثابت في مجلد `public`، والتعليقات تحفظ في قاعدة بيانات D1 على Cloudflare ولا تظهر للزوار.
- أزرار التنزيل تنزل الملف مباشرة من آخر إصدار منشور على GitHub دون أن يرى الزائر صفحة GitHub.
- للنشر: نفذ الأوامر في قسم «Deploy» أعلاه مرة واحدة، ثم `npx wrangler pages deploy` عند كل تحديث.
- لا يمكن قراءة التعليقات من الموقع نفسه: تقرؤها أنت فقط من لوحة Cloudflare أو بالأمر `node comments.mjs` على حاسوبك، بعد تسجيل الدخول إلى حسابك (فعّل التحقق بخطوتين).

</div>
