// Ahd website: language switch, OS-aware download button, Linux commands with this site's address, copy buttons,
// reveal-on-scroll, the ticking demo timer, and the feedback form (POST /api/comments).
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var T = {
    ar: {
      brand: 'عهد', navFeatures: 'المزايا', navDownload: 'التنزيل', navReq: 'المتطلبات', navFeedback: 'رأيك',
      eyebrow: 'مجاني ومفتوح المصدر · ويندوز ولينكس', h1a: 'رفيقك الهادئ', h1b: 'لمواقيت الصلاة',
      lede: 'مواقيت دقيقة حتى الثانية، وأذان لا يفوتك، والقرآن الكريم والأذكار والقبلة، في تطبيق واحد يعمل دون إنترنت ويحفظ خصوصيتك.',
      dlWindows: 'تنزيل لويندوز', dlLinux: 'تنزيل للينكس', allDownloads: 'كل خيارات التنزيل', version: 'بلا إعلانات ولا حسابات ولا تتبع', pillName: 'العصر',
      featKicker: 'المزايا', featTitle: 'كل ما تحتاجه للصلاة، في مكان واحد', featLede: 'صمم عهد ليبقى هادئا في الخلفية، ويذكرك بكل صلاة في وقتها.',
      f1t: 'مواقيت دقيقة', f1d: 'لأي مدينة في العالم دون إنترنت، بكل طرق الحساب المعروفة، مع ضبط كل صلاة بالثواني لتطابق مسجدك أو الجدول الرسمي.',
      f2t: 'الأذان في وقته', f2d: 'أذان خاص بالفجر، وتنبيه يمكن إغلاقه دون أن يتوقف الأذان، واختصار لإيقافه، ثم دعاء ما بعد الأذان.',
      f3t: 'على سطح المكتب', f3d: 'أداة رئيسية وأداة مصغرة تبقى فوق التطبيقات، والمؤقت بجانب الساعة في شريط المهام.',
      f4t: 'القرآن الكريم', f4d: 'بروايتي حفص وورش، بخط مجمع الملك فهد، مع البحث والعلامات وحفظ موضع القراءة.',
      f5t: 'الأذكار', f5d: 'أذكار الصباح والمساء وغيرها من حصن المسلم، مع عداد وتذكيرات.',
      f6t: 'القبلة', f6d: 'اتجاه القبلة من موقعك، والأوقات التي تكون فيها الشمس على خط القبلة، وأيام تعامد الشمس على الكعبة.',
      f7t: 'مكتبة', f7d: 'كتب مجانية مثل صحيح البخاري والرحيق المختوم، يتم تنزيلها عند طلبك وتقرأ داخل التطبيق.',
      f8t: 'خصوصيتك محفوظة', f8d: 'بلا حسابات ولا إعلانات ولا تتبع، وكل بياناتك تبقى على جهازك.',
      f9t: 'بالعربية والإنجليزية', f9d: 'واجهة كاملة باللغتين، مع مظهر فاتح وداكن.',
      shotsKicker: 'لمحة من التطبيق', shotsTitle: 'واجهة هادئة ومريحة للعين',
      shot1: 'المصحف بروايتي حفص وورش', shot2: 'الأذكار مع العداد، بالمظهر الداكن', shot3: 'الواجهة الإنجليزية',
      dlKicker: 'التنزيل', dlTitle: 'نزل عهد مجانا', dlLede: 'اختر نظامك. يبدأ التنزيل مباشرة.',
      winTitle: 'ويندوز', winDesc: 'مثبت عادي لا يحتاج صلاحيات المسؤول. ويندوز 10 و11 (64 بت).', winBtn: 'تنزيل المثبت (.exe)', winMsi: 'حزمة MSI',
      winNote: 'قد يظهر ويندوز رسالة «Windows protected your PC» لأن التطبيق جديد وغير موقع رقميا بعد: اضغط «More info» ثم «Run anyway».',
      linTitle: 'لينكس', tabDeb: 'أوبونتو · مينت', tabRpm: 'فيدورا', tabApp: 'AppImage', copy: 'نسخ',
      hintDeb: 'لأوبونتو ولينكس مينت وديبيان والتوزيعات المبنية عليها.', hintRpm: 'لفيدورا والتوزيعات التي تستخدم dnf.', hintApp: 'ملف واحد يعمل على أي توزيعة دون تثبيت.', copied: 'تم النسخ',
      getDeb: 'تنزيل ملف .deb', getRpm: 'تنزيل ملف .rpm', getApp: 'تنزيل ملف AppImage', linAfter: 'بعد التثبيت ستجد «عهد» في قائمة التطبيقات.',
      sums: 'بصمات SHA-256 للتحقق من الملفات', source: 'الشيفرة المصدرية',
      reqKicker: 'المتطلبات', reqTitle: 'متطلبات التشغيل', reqWin: 'ويندوز', reqWin1a: 'ويندوز 10 أو 11', reqWin1b: '(64 بت).',
      reqWin2: 'يثبت المثبت محرك WebView2 من مايكروسوفت تلقائيا إن لم يكن موجودا، ويحتاج ذلك اتصالا بالإنترنت أثناء التثبيت فقط.',
      reqWin3a: 'ويندوز 7 و8 غير مدعومين:', reqWin3b: 'أوقفت مايكروسوفت دعم محرك WebView2 لهما، وأدوات البناء الحديثة لم تعد تدعمهما.',
      reqLin: 'لينكس', reqLin1: 'توزيعة حديثة 64 بت: أوبونتو 22.04 أو أحدث، لينكس مينت 21 أو أحدث، ديبيان 12، فيدورا 39 أو أحدث.',
      reqLin2: 'أسطح المكتب: Cinnamon، MATE، GNOME (مع إضافة AppIndicator)، KDE، Xfce.',
      reqAll: 'للجميع', reqAll1: 'نحو 70 ميغابايت على القرص.', reqAll2: 'لا يحتاج إنترنت إلا لميزات اختيارية: البحث عن الأحياء، والخريطة، وتنزيل الكتب.', reqAll3: 'مكبر صوت أو سماعة لسماع الأذان.',
      fbKicker: 'رأيك', fbTitle: 'شاركنا رأيك', fbLede: 'اقتراح، أو مشكلة، أو كلمة شكر؟ تصل رسالتك إلى المطور مباشرة ولا تنشر على الموقع.',
      kSuggestion: 'اقتراح', kProblem: 'مشكلة', kThanks: 'شكر', fName: 'الاسم (اختياري)', fEmail: 'البريد الإلكتروني (اختياري، إن أردت ردا)', fMessage: 'رسالتك', fSend: 'إرسال',
      fPrivacy: 'نحفظ ما تكتبه فقط، ولا نستعمل بريدك إلا للرد عليك.',
      sending: 'جار الإرسال…', sent: 'وصلت رسالتك، جزاك الله خيرا.', errShort: 'الرسالة قصيرة جدا.', errEmail: 'تحقق من البريد الإلكتروني.',
      errRate: 'أرسلت عدة رسائل مؤخرا. حاول بعد ساعة.', errGeneric: 'تعذر الإرسال. حاول مرة أخرى بعد قليل.',
      footer: 'عهد — مجاني ومفتوح المصدر برخصة GPL-3.0', privacy: 'الخصوصية', releases: 'كل الإصدارات',
      title: 'عهد | برنامج مواقيت الصلاة والأذان للكمبيوتر — ويندوز ولينكس مجانا', langBtn: 'English', faqKicker: 'أسئلة شائعة', faqTitle: 'عن برنامج مواقيت الصلاة للكمبيوتر', faqQ1: 'ما هو برنامج عهد؟', faqA1: 'عهد برنامج مجاني لمواقيت الصلاة على الكمبيوتر، لنظامي ويندوز ولينكس. يعرض أوقات الصلاة لمدينتك، ويرفع الأذان في وقته، ويضم القرآن الكريم والأذكار واتجاه القبلة.', faqQ2: 'كيف أعرف أوقات الصلاة على الكمبيوتر؟', faqA2: 'نزّل عهد وثبّته، ثم اختر مدينتك. تظهر مواقيت الصلاة في نافذة البرنامج وفي أداة صغيرة على سطح المكتب، ويظهر العد التنازلي للصلاة القادمة في شريط المهام.', faqQ3: 'هل يعمل البرنامج على ويندوز 10 وويندوز 11؟', faqA3: 'نعم، يعمل على ويندوز 10 وويندوز 11 (64 بت)، وعلى لينكس: أوبونتو ولينكس مينت وديبيان وفيدورا وغيرها. لا يعمل على ويندوز 7.', faqQ4: 'هل يرفع البرنامج الأذان تلقائيا؟', faqA4: 'نعم، يرفع الأذان عند دخول وقت كل صلاة، مع أذان خاص بالفجر، ثم يعرض دعاء ما بعد الأذان. ويمكن إيقاف الأذان بزر أو باختصار من لوحة المفاتيح.', faqQ5: 'هل يحتاج البرنامج إلى الإنترنت؟', faqA5: 'لا. حساب المواقيت وقائمة المدن (أكثر من 171 ألف مكان) والقرآن الكريم والأذكار كلها داخل البرنامج. يلزم الإنترنت فقط لتنزيل كتب المكتبة عند طلبك.', faqQ6: 'ما طرق حساب مواقيت الصلاة المتاحة؟', faqA6: 'كل الطرق المعروفة، منها رابطة العالم الإسلامي، وأم القرى، والهيئة المصرية العامة للمساحة، وجامعة العلوم الإسلامية بكراتشي، ووزارة الأوقاف المغربية والجزائرية والأردنية، مع ضبط كل صلاة بالدقائق والثواني.', faqQ7: 'هل البرنامج مجاني فعلا؟', faqA7: 'نعم، مجاني ومفتوح المصدر، بلا إعلانات ولا حسابات ولا تتبع.'
    },
    en: {
      brand: 'Ahd', navFeatures: 'Features', navDownload: 'Download', navReq: 'Requirements', navFeedback: 'Feedback',
      eyebrow: 'Free and open source · Windows and Linux', h1a: 'A calm companion', h1b: 'for prayer times',
      lede: 'Prayer times accurate to the second, an adhan you won’t miss, the Quran, adhkar and the qibla, in one app that works offline and respects your privacy.',
      dlWindows: 'Download for Windows', dlLinux: 'Download for Linux', allDownloads: 'All downloads', version: 'No ads, no accounts, no tracking', pillName: 'Asr',
      featKicker: 'Features', featTitle: 'Everything for your prayers, in one place', featLede: 'Ahd stays quietly in the background and reminds you of every prayer on time.',
      f1t: 'Accurate times', f1d: 'For any city in the world, offline, with every common calculation method, and per-second fine-tuning of each prayer to match your mosque or the official timetable.',
      f2t: 'The adhan on time', f2d: 'A separate Fajr adhan, an alert you can close while the adhan keeps playing, a shortcut to stop it, then the dua after the adhan.',
      f3t: 'On your desktop', f3d: 'A main widget and a small one that can stay above other apps, and the timer next to the clock on the taskbar.',
      f4t: 'The Quran', f4d: 'Hafs and Warsh narrations in the King Fahd Complex script, with search, bookmarks and your last-read page.',
      f5t: 'Adhkar', f5d: 'Morning, evening and more from Hisn al-Muslim, with a counter and reminders.',
      f6t: 'Qibla', f6d: 'The qibla from where you are, the times the sun lines up with it, and the days the sun passes over the Kaaba.',
      f7t: 'A library', f7d: 'Free books such as Sahih al-Bukhari and Ar-Raheeq al-Makhtum, downloaded when you ask and read inside the app.',
      f8t: 'Private by design', f8d: 'No accounts, no ads, no tracking. Your data stays on your computer.',
      f9t: 'Arabic and English', f9d: 'A full interface in both languages, with light and dark themes.',
      shotsKicker: 'A look inside', shotsTitle: 'A calm interface that is easy on the eyes',
      shot1: 'The mushaf in Hafs and Warsh', shot2: 'Adhkar with a counter, in the dark theme', shot3: 'The English interface',
      dlKicker: 'Download', dlTitle: 'Get Ahd for free', dlLede: 'Choose your system. The download starts right away.',
      winTitle: 'Windows', winDesc: 'A normal installer, no administrator rights needed. Windows 10 and 11 (64-bit).', winBtn: 'Download installer (.exe)', winMsi: 'MSI package',
      winNote: 'Windows may show “Windows protected your PC” because the app is new and not yet digitally signed: click “More info”, then “Run anyway”.',
      linTitle: 'Linux', tabDeb: 'Ubuntu · Mint', tabRpm: 'Fedora', tabApp: 'AppImage', copy: 'Copy',
      hintDeb: 'For Ubuntu, Linux Mint, Debian and distributions based on them.', hintRpm: 'For Fedora and other distributions that use dnf.', hintApp: 'A single file that runs on any distribution, no installation needed.', copied: 'Copied',
      getDeb: 'Download .deb file', getRpm: 'Download .rpm file', getApp: 'Download AppImage', linAfter: 'After installing, find Ahd in your applications menu.',
      sums: 'SHA-256 checksums to verify the files', source: 'Source code',
      reqKicker: 'Requirements', reqTitle: 'System requirements', reqWin: 'Windows', reqWin1a: 'Windows 10 or 11', reqWin1b: '(64-bit).',
      reqWin2: 'The installer adds Microsoft’s WebView2 engine if it is missing; that needs an internet connection during installation only.',
      reqWin3a: 'Windows 7 and 8 are not supported:', reqWin3b: 'Microsoft ended WebView2 support for them, and current build tools no longer target them.',
      reqLin: 'Linux', reqLin1: 'A current 64-bit distribution: Ubuntu 22.04 or later, Linux Mint 21 or later, Debian 12, Fedora 39 or later.',
      reqLin2: 'Desktops: Cinnamon, MATE, GNOME (with the AppIndicator extension), KDE, Xfce.',
      reqAll: 'Everyone', reqAll1: 'About 70 MB of disk space.', reqAll2: 'Internet only for optional features: neighbourhood search, the map and book downloads.', reqAll3: 'Speakers or headphones for the adhan.',
      fbKicker: 'Feedback', fbTitle: 'Share your feedback', fbLede: 'A suggestion, a problem or a word of thanks? Your message goes straight to the developer and is not published on the site.',
      kSuggestion: 'Suggestion', kProblem: 'Problem', kThanks: 'Thanks', fName: 'Name (optional)', fEmail: 'Email (optional, if you’d like a reply)', fMessage: 'Your message', fSend: 'Send',
      fPrivacy: 'We keep only what you write, and use your email only to reply to you.',
      sending: 'Sending…', sent: 'Thank you, your message has arrived.', errShort: 'The message is too short.', errEmail: 'Please check the email address.',
      errRate: 'You have sent several messages recently. Please try again in an hour.', errGeneric: 'Could not send your message. Please try again in a moment.',
      footer: 'Ahd — free and open source under GPL-3.0', privacy: 'Privacy', releases: 'All releases',
      title: 'Ahd | Free prayer times and adhan app for PC — Windows and Linux', langBtn: 'العربية', faqKicker: 'Questions', faqTitle: 'About the prayer times app for PC', faqQ1: 'What is Ahd?', faqA1: 'Ahd is a free prayer times app for PC, for Windows and Linux. It shows the prayer times for your city, plays the adhan on time, and includes the Quran, adhkar and the qibla direction.', faqQ2: 'How do I see prayer times on my computer?', faqA2: 'Download and install Ahd, then choose your city. The prayer times appear in the app window and in a small desktop widget, and the countdown to the next prayer shows in the taskbar.', faqQ3: 'Does it work on Windows 10 and Windows 11?', faqA3: 'Yes, on Windows 10 and Windows 11 (64-bit), and on Linux: Ubuntu, Linux Mint, Debian, Fedora and others. It does not run on Windows 7.', faqQ4: 'Does it play the adhan automatically?', faqA4: 'Yes. It plays the adhan when each prayer time begins, with a separate Fajr adhan, then shows the dua after the adhan. A button or a keyboard shortcut stops it.', faqQ5: 'Does it need the internet?', faqA5: 'No. The prayer time calculation, the list of places (over 171,000), the Quran and the adhkar are all inside the app. The internet is only used to download library books when you ask.', faqQ6: 'Which calculation methods are available?', faqA6: 'All the common ones, including the Muslim World League, Umm al-Qura, the Egyptian General Authority of Survey, the University of Islamic Sciences in Karachi, and the ministries of Morocco, Algeria and Jordan, with per-prayer adjustment in minutes and seconds.', faqQ7: 'Is it really free?', faqA7: 'Yes. Free and open source, with no ads, no accounts and no tracking.'
    }
  };

  var lang = 'ar';
  // Arabic first; English only when the visitor chose it with the language button
  try { lang = localStorage.getItem('ahd-lang') || 'ar'; } catch (e) { /* storage blocked */ }
  // ?lang=en / ?lang=ar (the English address search engines index) wins over the stored choice
  var asked = new URLSearchParams(location.search).get('lang');
  if (asked === 'en' || asked === 'ar') lang = asked;
  if (!T[lang]) lang = 'ar';

  var os = /Windows/i.test(navigator.userAgent) ? 'windows' : /Linux/i.test(navigator.userAgent) && !/Android/i.test(navigator.userAgent) ? 'linux' : 'windows';

  function apply() {
    var t = T[lang];
    var html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t.title;
    document.querySelectorAll('[data-t]').forEach(function (el) {
      var v = t[el.getAttribute('data-t')];
      if (v !== undefined) el.textContent = v;
    });
    document.getElementById('lang').textContent = t.langBtn;
    var shot = document.getElementById('hero-shot');
    if (shot) shot.src = lang === 'ar' ? '/assets/img/home-ar.webp' : '/assets/img/home-en.webp';
    var primary = document.getElementById('primary-dl');
    var label = document.getElementById('primary-label');
    if (os === 'linux') {
      primary.href = '#download';
      primary.removeAttribute('download');
      label.textContent = t.dlLinux;
    } else {
      label.textContent = t.dlWindows;
    }
  }

  document.getElementById('lang').addEventListener('click', function () {
    lang = lang === 'ar' ? 'en' : 'ar';
    try { localStorage.setItem('ahd-lang', lang); } catch (e) { /* storage blocked */ }
    if (location.search) history.replaceState(null, '', location.pathname + location.hash);
    apply();
  });

  // Linux commands with this site's own address
  document.querySelectorAll('[data-cmd]').forEach(function (pre) {
    var cmd = pre.getAttribute('data-cmd').split('{origin}').join(location.origin);
    cmd.split('\n').forEach(function (line) {
      var row = document.createElement('span');
      row.className = 'ln';
      var p = document.createElement('span');
      p.className = 'p';
      p.textContent = '$ ';
      row.appendChild(p);
      // on narrow screens a line wraps only at a space or after a "/" (never inside a file name)
      line.split(/(\s+|\/+)/).forEach(function (part) {
        if (!part) return;
        if (/^\s+$/.test(part) || /^\/+$/.test(part)) {
          row.appendChild(document.createTextNode(part));
          if (part === '/') row.appendChild(document.createElement('wbr'));
        } else {
          var w = document.createElement('span');
          w.className = 'w';
          w.textContent = part;
          row.appendChild(w);
        }
      });
      pre.appendChild(row);
    });
    pre.setAttribute('data-text', cmd);
  });
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var pre = btn.closest('.term').querySelector('pre');
      var text = pre.getAttribute('data-text');
      var done = function () {
        btn.textContent = T[lang].copied;
        setTimeout(function () { btn.textContent = T[lang].copy; }, 1600);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, function () { select(pre); });
      else select(pre);
    });
  });
  function select(el) {
    var r = document.createRange();
    r.selectNodeContents(el);
    var s = window.getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }

  // Linux tabs
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[role="tab"]'));
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
    });
  });

  // reveal on scroll (content is visible without JavaScript)
  var reveal = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    reveal.forEach(function (el, i) { el.style.setProperty('--d', (i % 3) * 0.08 + 's'); io.observe(el); });
  } else {
    reveal.forEach(function (el) { el.classList.add('in'); });
  }

  // the demo widget ticks like the real one
  var pill = document.getElementById('pill-time');
  var secs = 1 * 3600 + 12 * 60 + 8;
  setInterval(function () {
    secs++;
    var h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
    pill.textContent = '+' + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }, 1000);

  // the app window tilts slightly toward the pointer
  var stage = document.getElementById('stage');
  var win = document.getElementById('window');
  if (stage && win && window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    stage.addEventListener('mousemove', function (e) {
      var r = stage.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      win.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
      win.style.setProperty('--rx', (-y * 8).toFixed(2) + 'deg');
    });
    stage.addEventListener('mouseleave', function () { win.style.removeProperty('--ry'); win.style.removeProperty('--rx'); });
  }

  // feedback form
  var form = document.getElementById('fb-form');
  var status = document.getElementById('fb-status');
  var send = document.getElementById('fb-send');
  var opened = Date.now();
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var t = T[lang];
    var data = {
      kind: (form.querySelector('input[name="kind"]:checked') || {}).value || 'suggestion',
      name: document.getElementById('fb-name').value.trim(),
      email: document.getElementById('fb-email').value.trim(),
      message: document.getElementById('fb-message').value.trim(),
      website: document.getElementById('fb-website').value,
      lang: lang,
      elapsed: Date.now() - opened
    };
    status.className = 'status';
    if (data.message.length < 3) { status.className = 'status err'; status.textContent = t.errShort; return; }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) { status.className = 'status err'; status.textContent = t.errEmail; return; }
    send.disabled = true;
    status.textContent = t.sending;
    fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (res) { return res.json().catch(function () { return {}; }).then(function (j) { return { ok: res.ok, body: j }; }); })
      .then(function (r) {
        if (r.ok) {
          status.className = 'status ok';
          status.textContent = t.sent;
          document.getElementById('fb-message').value = '';
        } else {
          status.className = 'status err';
          var code = r.body && r.body.error;
          status.textContent = code === 'rate_limited' ? t.errRate : code === 'too_short' ? t.errShort : code === 'bad_email' ? t.errEmail : t.errGeneric;
        }
      })
      .catch(function () { status.className = 'status err'; status.textContent = t.errGeneric; })
      .then(function () { send.disabled = false; });
  });

  apply();
})();
