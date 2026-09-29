<div dir="rtl">

**عهد**: مواقيت الصلاة والأذان والقرآن الكريم والأذكار والقبلة، لويندوز ولينكس. مجاني، يحفظ خصوصيتك، بلا حسابات ولا إعلانات ولا تتبع.

**الموقع والتنزيل:** https://3ahd.pages.dev

- **ويندوز 10 أو 11 (64 بت)**: نزّل `Ahd-windows-x64-setup.exe` وشغّله. إذا ظهرت رسالة «Windows protected your PC» فاضغط «More info» ثم «Run anyway».
- **أوبونتو ولينكس مينت وديبيان**: ملف `.deb`، و**فيدورا**: ملف `.rpm`، و**أي توزيعة**: ملف `.AppImage`.

</div>

---

**Ahd** — prayer times, adhan, Quran, adhkar and qibla for Windows and Linux. Free and private: no accounts, no ads, no tracking.

**Website:** https://3ahd.pages.dev

| System | File |
| --- | --- |
| Windows 10 / 11 (64-bit) | `Ahd-windows-x64-setup.exe` (or `Ahd-windows-x64.msi`) |
| Ubuntu, Linux Mint, Debian | `Ahd-linux-amd64.deb` |
| Fedora | `Ahd-linux-x86_64.rpm` |
| Any Linux distribution | `Ahd-linux-x86_64.AppImage` |

Install on Ubuntu / Linux Mint / Debian from a terminal:

```sh
wget -O ahd.deb https://3ahd.pages.dev/download/Ahd-linux-amd64.deb
sudo apt install ./ahd.deb
```

Windows may show "Windows protected your PC" because the installer is not code-signed yet: choose **More info → Run anyway**.

Verify a download with `sha256sum -c SHA256SUMS --ignore-missing`.
