/**
 * Uzbek — the default locale and the reference dictionary.
 *
 * Every other locale is typed against these keys, so a missing translation is
 * a compile error rather than a key leaking onto a clinician's screen.
 *
 * Clinical vocabulary stays conservative: where a Russian-derived medical term
 * is what staff actually say in an Uzbek clinic (tashxis, profilaktika), that
 * is the term used, not a coined alternative.
 */
export const uz = {
  // Chrome
  "app.tagline": "Klinik qaror qo'llab-quvvatlash",
  "nav.dashboard": "Boshqaruv paneli",
  "nav.patients": "Bemorlar",
  "nav.alerts": "Ogohlantirishlar",
  "nav.doctors": "Shifokorlar",
  "nav.audit": "Audit jurnali",
  "nav.subscription": "Obuna",
  "nav.history": "Tarix",
  "nav.diagnoses": "Tashxislar",
  "nav.medications": "Dorilar",
  "nav.digitalTwin": "Raqamli egizak",
  "nav.chat": "Suhbat",
  "nav.menu": "Menyu",
  "nav.toggle": "Navigatsiyani ochish",

  "role.admin": "Klinika administratori",
  "role.doctor": "Shifokor",
  "role.patient": "Bemor",

  "action.signIn": "Kirish",
  "action.signOut": "Chiqish",
  "action.cancel": "Bekor qilish",
  "action.add": "Qo'shish",
  "action.close": "Yopish",

  // Theme
  "theme.day": "Kunduzgi",
  "theme.night": "Tungi",
  "theme.toDay": "Kunduzgi rejimga o'tish",
  "theme.toNight": "Tungi rejimga o'tish",

  // Language
  "lang.label": "Til",
  "lang.uz": "O'zbekcha",
  "lang.en": "English",
  "lang.ru": "Русский",

  // Digital twin
  "twin.zoomIn": "Kattalashtirish",
  "twin.zoomOut": "Kichiklashtirish",
  "twin.fit": "Moslash",
  "twin.front": "Old",
  "twin.back": "Orqa",
  "twin.left": "Chap",
  "twin.right": "O'ng",
  "twin.current": "HOZIRGI",
  "twin.projected": "BASHORAT",
  "twin.day": "KUN",
  "twin.horizon": "Bashorat muddati",
  "twin.playing": "Ijro etilmoqda",
  "twin.play": "Ijro etish",
  "twin.today": "Bugun",
  "twin.dayN": "{n}-kun",
  "twin.separated": "A'zolar ajratilgan",
  "twin.wholeBody": "Butun tana",
  "twin.zoomHint": "Ajratilgan ko'rinish uchun kattalashtiring",

  // Sign in
  "login.title": "Kirish",
  "login.subtitle":
    "Klinika xodimlari va bemorlar bitta eshikdan kiradi; ko'rsatiladigan narsa rolingizga bog'liq.",
  "login.email": "Elektron pochta",
  "login.password": "Parol",
  "login.show": "Ko'rsatish",
  "login.hide": "Yashirish",
  "login.signingIn": "Kirilmoqda…",
  "login.badCredentials": "Bu pochta va parol hech bir hisobga mos kelmadi.",
  "login.noServer": "Serverga ulanib bo'lmadi. API ishlayotganini tekshiring.",
  "login.registerPrompt": "Klinikani ro'yxatdan o'tkazmoqchimisiz?",
  "login.registerLink": "7 kunlik demoni boshlang",
  "login.demoClinic": "Demo klinika · sintetik ma'lumotlar",
  "login.demoNote":
    "Bu klinikadagi har bir bemor uydirma. API lokal bo'lgani uchun ko'rsatilmoqda.",

  // Patient chart
  "chart.tabChart": "Karta",
  "chart.tabAnalysis": "Tahlil",
  "chart.tabPrevention": "Profilaktika",
  "chart.tabDocuments": "Hujjatlar",
  "chart.eyebrow": "Bemor kartasi",
  "chart.diagnoses": "Tashxislar",
  "chart.medications": "Dorilar",
  "chart.pastHistory": "O'tmish tarixi",
  "chart.pastHistoryBody":
    "Oldingi voqeani — o'tgan tashxis, muolaja yoki tahlil natijasini — yozib qo'ying, shunda qoidalar to'liq vaqt chizig'idan o'qiydi.",
  "chart.noDiagnoses": "Hali tashxis yo'q",
  "chart.noDiagnosesBody":
    "Bittasini qo'shing. U siz ko'rib chiqadigan va tasdiqlaydigan klinik kontekstga yoyiladi.",
  "chart.noMedications": "Hali dori yo'q",
  "chart.noMedicationsBody":
    "Taklif qilinayotgan dorini qo'shing, keyin retsept yozishdan oldin yorlig'ini ko'rib chiqing.",
  "chart.reference": "Ma'lumotnoma",
  "chart.patientCode": "Bemor kodi",
  "chart.status": "Holati",
  "chart.phone": "Telefon",

  // Analysis
  "analysis.whatToAnalyse": "Nimani tahlil qilish kerak",
  "analysis.overWhatPeriod": "Qaysi muddat uchun",
  "analysis.nothingYet": "Hali tahlil qiladigan narsa yo'q",
  "analysis.nothingYetBody":
    "Tahlil uchun kartada kamida bitta tashxis va bitta dori bo'lishi kerak.",
  "analysis.goToChart": "Kartaga o'tish",
  "analysis.run": "{n} kunlik tahlilni ishga tushirish",
  "analysis.running": "Ishlamoqda…",
  "analysis.rulesFirst":
    "Avval deterministik qoidalar ishlaydi; model faqat natijani tushuntiradi.",
  "analysis.selectPrompt": "Yuqoridan kamida bitta tashxis va bitta dorini tanlang.",
  "analysis.customDates": "Boshqa sanalar",
  "analysis.usePreset": "Tayyor muddatdan foydalanish",
  "analysis.from": "Dan",
  "analysis.to": "Gacha",
  "analysis.days": "{n} kun",
  "analysis.oneYear": "1 yil",
  "analysis.latestProjection": "So'nggi bashorat",
  "analysis.failed": "Tahlilni bajarib bo'lmadi",

  // Prevention
  "prevention.heading": "Oldini olish",
  "prevention.label": "Profilaktika rejasi",
  "prevention.intro":
    "Shifokoringiz tasdiqlagan qiymatlar asosida tuzilgan. Bu faqat odatlar va uchrashuvlar — bu yerda hech narsa dorilaringizni o'zgartirmaydi, buni faqat shifokoringiz qila oladi.",
  "prevention.dailyRoutine": "Kunlik tartib",
  "prevention.ifYouKeep": "Agar shuni davom ettirsangiz",
  "prevention.measuredBy": "Nima bilan o'lchanadi:",
  "prevention.guardsAgainst": "Nimadan saqlaydi:",
  "prevention.sharpen": "Nima aniqroq qiladi",
  "prevention.sharpenBody":
    "Bu qiymatlar mavjud emas, shuning uchun ularga bog'liq narsalar taxmin qilinmaydi, balki tashlab ketiladi: {list}.",
  "prevention.none": "Hozir kartangizga mos profilaktika dasturi yo'q.",
  "prevention.noneBody":
    "Bu sog'lomlik guvohnomasi emas — bu tasdiqlangan yozuvlar ushbu katalog tekshiradigan chegaralardan o'tmaganini bildiradi.",
  "prevention.stillMissing": "Hali yetishmayapti:",
  "prevention.catalogue": "Profilaktika katalogi {version} · faqat tasdiqlangan yozuvlardan",
  "prevention.failed":
    "Profilaktika rejasini yuklab bo'lmadi. Kartangizda hech qanday xatolik yo'q — biroz keyin urinib ko'ring.",

  "time.morning": "Ertalab",
  "time.midday": "Tushda",
  "time.evening": "Kechqurun",
  "time.anytime": "Istalgan vaqtda",
} as const;

export type MessageKey = keyof typeof uz;
