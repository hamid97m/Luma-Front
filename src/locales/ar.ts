import type { Messages } from '../i18n.js'

// Arabic locale (MSA, informal register) — mirrors fa.ts key-for-key
// (enforced by tests/i18n.shape.test.ts). Masculine-neutral where Arabic
// forces a choice; Blocked screen formal. User-visible digits stay Latin.
// Arabic letterforms only (U+064A yeh, U+0643 kaf) — never the Persian-only
// letters (U+067E, U+0686, U+0698, U+06AF, U+06A9, U+06CC).

/** Arabic number agreement: 1 → singular, 2 → dual, 3–10 → plural, 0 and 11+ → singular (accusative). */
const count = (n: number, one: string, two: string, few: string, many: string): string => {
  if (n === 1) return one
  if (n === 2) return two
  if (n >= 3 && n <= 10) return `${n} ${few}`
  return `${n} ${many}`
}
const days = (n: number) => count(n, 'يوم واحد', 'يومان', 'أيام', 'يومًا')
const friends = (n: number) => count(n, 'صديق واحد', 'صديقان', 'أصدقاء', 'صديقًا')
const moreFriends = (n: number) => count(n, 'صديق واحد آخر', 'صديقان آخران', 'أصدقاء آخرين', 'صديقًا آخر')
const extraSwipes = (n: number) =>
  count(n, 'سحبة اكتشاف إضافية واحدة', 'سحبتا اكتشاف إضافيتان', 'سحبات اكتشاف إضافية', 'سحبة اكتشاف إضافية')
const likedYouCount = (n: number) =>
  count(n, 'شخص واحد أُعجب بك', 'شخصان أُعجبا بك', 'أشخاص أُعجبوا بك', 'شخصًا أُعجبوا بك')

export const ar = {
  appName: 'Luma',
  splash: {
    messages: [
      'اعثر على نصفك الآخر',
      'صور حقيقية فقط — كل الملفات موثّقة',
      'من كل 10 أعضاء، 8 يجدون توافقًا',
      'محادثاتك تبقى خاصة دائمًا',
      'يمكنك إيقاف حسابك مؤقتًا أو حذفه في أي وقت',
    ],
    // Extra taglines mixed in when the cached account gender is woman.
    messagesWomen: [
      'لوما مبني مع التركيز على أمان النساء',
      'مكان آمن للنساء — تعرّفي على أشخاص جدد براحة بال',
    ],
  },
  next: 'متابعة',
  save: 'حفظ',
  discovery: {
    empty: 'شاهدت الجميع',
    emptyHint: 'شاهدت كل من حولك. ينضم أشخاص جدد كل يوم — سنخبرك.',
    reviewAgain: 'مراجعة الملفات مجددًا',
    like: 'إعجاب',
    pass: 'تخطّي',
    nearby: 'بالقرب منك',
    swipeHint: 'اسحب للإعجاب أو التخطّي · انقر لتصفّح الصور',
  },
  rewind: {
    title: 'العودة إلى الملف السابق',
    body: 'تخطّيت أحدهم بالخطأ؟ مع بريميوم يمكنك العودة إلى الملف السابق واتخاذ قرارك من جديد. هذه الميزة خاصة بأعضاء بريميوم.',
    getPremium: 'احصل على بريميوم',
    cancel: 'إلغاء',
    paywallSubtitle: 'اشترك في بريميوم لرؤية الملف السابق',
  },
  match: {
    title: 'حدث توافق!',
    message: (name: string) => `أنت و${name} أعجبتما ببعضكما`,
    send: (name: string) => `رسالة إلى ${name}`,
    keepSwiping: 'متابعة السحب',
  },
  notify: {
    title: 'لا تفوّت أي توافق',
    body: 'اسمح للوما بإرسال رسالة لك على تيليجرام عندما يُعجب بك أحد أو يراسلك.',
    enable: 'تفعيل الإشعارات',
    later: 'ليس الآن',
  },
  matches: {
    title: 'التوافقات',
    empty: 'لا توافقات بعد',
    emptyHint:
      'عندما تُعجب أنت وشخص آخر ببعضكما، ستريان بعضكما هنا. توافقك التالي على بُعد سحبة واحدة.',
    startDiscovering: 'ابدأ الاكتشاف',
    newBadge: 'جديد',
    sayHi: 'قل مرحبًا!',
  },
  chat: {
    placeholder: 'اكتب رسالة…',
    send: 'إرسال',
    viewProfile: 'عرض الملف الشخصي',
    unavailable: 'هذا التوافق لم يعد متاحًا.',
    loadError: 'تعذّر تحميل هذه المحادثة.',
    retry: 'إعادة المحاولة',
    failed: 'لم يتم الإرسال — انقر لإعادة المحاولة',
    sendingLabel: 'جارٍ الإرسال',
    matched: (name: string) => `حدث توافق بينك وبين ${name}`,
    matchedOn: (date: string) => date,
    icebreakerOf: (name: string) => `كاسر جليد ${name}`,
    askAboutIt: 'اسأل عنه',
    icebreakerPrefill: (answer: string) => `حسنًا، «${answer}» — احكِ لي القصة كاملة`,
    openers: [
      'ما الشيء الذي حسّن مزاجك هذا الأسبوع؟',
      'شاي أم قهوة؟ إجابتك تكشف الكثير😄',
      'لو كان بإمكانك أن تكون في أي مكان غير هنا الآن، أين ستكون؟',
    ],
    scrollToLatest: 'الانتقال إلى آخر رسالة',
    edited: 'معدَّلة',
    editingMessage: 'تعديل الرسالة',
    save: 'حفظ',
    editAction: 'تعديل',
    deleteAction: 'حذف',
    retryMessage: 'إعادة المحاولة',
    cancelAction: 'إلغاء',
    messageActions: 'خيارات الرسالة',
    replyAction: 'رد',
    replyingLabel: 'جارٍ الرد على',
    replyYou: 'أنت',
    replyDeleted: 'الرسالة الأصلية محذوفة',
    icebreakerFallbackQuestion: 'وأنت؟',
    yourIcebreaker: 'كاسر الجليد الخاص بك',
    waitingForAnswer: (name: string) => `بانتظار إجابة ${name}`,
    answerIt: 'أجب',
    icebreakerPreviewMine: 'تم إرسال كاسر الجليد الخاص بك',
  },
  profile: {
    title: 'ملفي الشخصي',
    photos: 'الصور',
    nameLabel: 'الاسم',
    ageLabel: 'العمر',
    locationLabel: 'الموقع',
    bioLabel: 'نبذة عني',
    icebreakerLabel: 'كاسر الجليد',
    addInterest: '+ إضافة',
    aboutPlaceholder: 'حدّثنا عن نفسك…',
  },
  nav: {
    discovery: 'اكتشاف',
    matches: 'الدردشة',
    profile: 'ملفي',
    likes: 'الإعجابات',
  },
  likes: {
    empty: 'لا إعجابات بعد',
    emptySub: 'تابع السحب — عندما يُعجب بك أحد، سيظهر هنا أولًا.',
    subtitle: (n: number) => likedYouCount(n),
    subtitleHidden: (n: number, hidden: number) => `${likedYouCount(n)} · ${hidden} مخفي`,
    subtitleAllVisible: (n: number) => `${likedYouCount(n)} — الكل ظاهر`,
    bannerCount: (m: number) => count(m, 'إعجاب واحد مخفي', 'إعجابان مخفيان', 'إعجابات مخفية', 'إعجابًا مخفيًا'),
    bannerSub: 'اشترك في بريميوم لترى كل من أُعجب بك وتبادلهم الإعجاب.',
    free: 'مجاني',
    premium: 'بريميوم',
    likedYou: (when: string) => `أُعجب بك ${when}`,
    likeBack: 'بادل الإعجاب',
    paywallSubtitle: 'اشترك في بريميوم لترى كل من أُعجب بك وتبادلهم الإعجاب.',
  },
  errors: {
    generic: 'حدث خطأ ما',
    unknown: 'خطأ غير معروف',
    retry: 'إعادة المحاولة',
  },
  report: {
    title: 'الإبلاغ عن مستخدم',
    reasonFake: 'ملف شخصي أو صور مزيفة',
    reasonInappropriate: 'محتوى غير لائق أو صريح',
    reasonHarassment: 'تحرّش أو إساءة',
    reasonSpam: 'رسائل مزعجة أو احتيال',
    reasonOther: 'أخرى',
    notePlaceholder: 'ملاحظة (اختياري)',
    submit: 'إرسال البلاغ',
    thanks: 'شكرًا — سيراجع فريقنا البلاغ.',
    cancel: 'إلغاء',
  },
  block: {
    action: 'حظر المستخدم',
    title: (name: string) => `حظر ${name}؟`,
    body: 'لن يتمكن بعد الآن من مراسلتك أو رؤية ملفك الشخصي. ستُحذف هذه المحادثة من قائمة توافقاتك. ولن يعلم أنه محظور.',
    confirm: (name: string) => `حظر ${name}`,
    cancel: 'إلغاء',
  },
  support: {
    title: 'الدعم',
    emptyTitle: 'كل شيء على ما يرام',
    empty: 'ليس لديك تذاكر بعد. إذا كان هناك شيء لا يعمل، أخبرنا — نردّ عادةً خلال يوم.',
    newTicket: 'تذكرة جديدة',
    composePlaceholder: 'اشرح مشكلتك…',
    submit: 'إرسال',
    replyPlaceholder: 'رد…',
    open: 'مفتوحة',
    closed: 'مغلقة',
    tooMany: 'لديك تذاكر مفتوحة كثيرة. يرجى انتظار الرد.',
    error: 'حدث خطأ ما. يرجى المحاولة مجددًا.',
    back: 'رجوع',
  },
  blocked: {
    title: 'تم حظر حسابك',
    body: 'تم حظر حسابك بسبب انتهاك قواعد المجتمع. إذا كنت تعتقد أن ذلك حدث عن طريق الخطأ، يرجى التواصل مع الدعم.',
    support: 'التواصل مع الدعم',
  },
  photoRequired: {
    title: 'نحتاج إلى صورة جديدة',
    body: 'تم إخفاء ملفك الشخصي مؤقتًا. للعودة إلى لوما، ارفع صورة حديثة وواضحة لك.',
    upload: 'رفع صورة',
    uploading: 'جارٍ الرفع…',
    error: 'فشل الرفع. يرجى المحاولة مجددًا.',
  },
  gifts: {
    title: (name: string) => `إرسال هدية إلى ${name}`,
    close: 'إغلاق',
    unavailable: 'الهدايا غير متاحة حاليًا',
    notePlaceholder: 'ملاحظة (اختياري)',
    selectPrompt: 'اختر هدية',
    send: (emoji: string, stars: number) => `إرسال ${emoji} مقابل ★${stars}`,
    sending: 'جارٍ إرسال الهدية…',
    refunded: 'تم ردّ المبلغ — لم تُرسل الهدية',
    error: 'حدث خطأ ما. يرجى المحاولة مجددًا.',
    openButton: 'إرسال هدية',
    sentByMe: 'أرسلت هدية',
    sentByOther: (name: string) => `${name} أرسل لك هدية`,
    sentToast: (name: string) => `تم إرسال الهدية إلى ${name} 🎁`,
    introsTitle: 'هدايا لك 🎁', // design: «هدايا لك» — emoji kept from existing UI
    introSubtitle: 'أرسل لك هدية',
    accept: 'قبول',
    dismiss: 'رفض',
    introAcceptError: 'تعذّر قبول الهدية. يرجى المحاولة مجددًا.',
    introDismissError: 'تعذّر الرفض. يرجى المحاولة مجددًا.',
  },
  premium: {
    title: 'لوما بريميوم',
    subtitle: 'اشترك في بريميوم لإرسال الرسائل',
    days: (n: number) => days(n),
    buy: (stars: number) => `متابعة — ★${stars}`,
    asanstar: 'آسان ستار · شراء آمن للمستخدمين الإيرانيين',
    selectPrompt: 'اختر خطة',
    activating: 'جارٍ تفعيل بريميوم…',
    refunded: 'تم ردّ المبلغ — لم يُفعَّل بريميوم',
    error: 'حدث خطأ ما. يرجى المحاولة مجددًا.',
    close: 'إغلاق',
    noPlans: 'بريميوم غير متاح حاليًا',
    active: 'مفعّل',
    badge: 'بريميوم',
    daysLeft: (n: number) => {
      if (n === 1) return 'بقي يوم واحد'
      if (n === 2) return 'بقي يومان'
      if (n >= 3 && n <= 10) return `بقيت ${n} أيام`
      return `بقي ${n} يومًا`
    },
    endsToday: 'ينتهي اليوم',
    until: (date: string) => `حتى ${date}`,
    pitch: 'افتح المراسلة غير المحدودة والمزيد من المزايا مع لوما بريميوم.',
    getButton: 'احصل على بريميوم',
    endsIn: (time: string) => `ينتهي العرض خلال ${time}`,
    countdownDays: (days_: number, hms: string) => `${days(days_)} ${hms}`,
    or: 'أو',
    benefitSwipes: 'سحب غير محدود',
    benefitChat: 'الدردشة مع الجميع',
    benefitLikes: 'اعرف من أُعجب بك',
    bestValue: 'الأوفر',
    perWeek: (stars: number) => `≈ ★${stars}/أسبوع`,
    payHint: 'الدفع بنجوم تيليجرام · إلغاء في أي وقت',
    socialProof: 'من كل 10 أعضاء بريميوم، 8 يجدون توافقًا خلال شهر',
    // Prominent CTA on the paywall that opens the full 3-step "buy Stars" guide.
    starsGuideCta: 'ليس لديك نجوم؟ لا مشكلة',
    starsGuideCtaHint: 'اشترِ النجوم بالريال في 3 خطوات وعُد — اطّلع على الدليل',
    // Secondary collapsible on the paywall listing alternative ways to get Stars.
    otherWaysToggle: 'ليس لديك نجوم؟ اطّلع على طريقة الشراء',
    otherWaysLabel: 'طرق أخرى',
    otherWays: [
      {
        title: 'داخل تيليجرام',
        body: 'الإعدادات ← نجومي ← شراء المزيد من النجوم. يتطلب وسيلة دفع دولية.',
      },
      {
        title: 'بعملة TON عبر فراجمنت',
        body: 'اشترِ TON من منصة تداول محلية واحصل على النجوم من fragment.com — دون الحاجة إلى بطاقة أجنبية.',
      },
      {
        title: 'من بائع محلي',
        body: 'كثير من المتاجر الموثوقة تبيع النجوم كهدية إلى حساب تيليجرام الخاص بك. الدفع بالريال — راجع التقييمات قبل الشراء.',
      },
    ],
  },
  // "How to buy Stars" guide — a 3-step flow that sends Iranian users to a
  // rial reseller (Asan Star recommended) then back to the paywall.
  // Hidden for non-fa locales (Task 13) but kept for shape parity.
  howToBuyStars: {
    title: 'شراء نجوم تيليجرام',
    // Info card. `needTitle` reads "للحصول على {plan} تحتاج إلى" and is followed
    // by a colored ★{stars}, then `needTitleAfter`, composed in the component.
    needTitle: (plan: string) => `للحصول على ${plan} تحتاج إلى`,
    needTitleAfter: 'من نجوم تيليجرام',
    // Fallback when no specific plan/price is in context.
    needTitleGeneric: 'تحتاج إلى نجوم تيليجرام للحصول على بريميوم',
    whatBody: 'النجوم هي وحدة الدفع داخل تيليجرام — تشتريها بالريال وتُضاف إلى حساب تيليجرام الخاص بك.',
    // Step 1 — buy Stars from a reseller.
    step1Title: 'اشترِ النجوم من أحد هذه المواقع',
    asanName: 'آسان ستار',
    asanBadge: 'اختيارنا',
    asanBody: 'الطريقة الأسرع — دفع بالريال، دون بطاقة أجنبية، تسليم تلقائي.',
    asanButton: (stars: number) => `شراء ★${stars} من آسان ستار`,
    asanButtonGeneric: 'الشراء من آسان ستار',
    resellers: [
      { name: 'إيراني كارد', domain: 'iranicard.ir', url: 'https://www.iranicard.ir/payments/foreign-services/telegram-stars/' },
      { name: 'نامبرلاند', domain: 'numberland.ir', url: 'https://numberland.ir/account/telegram-stars' },
    ],
    // Step 2 — Stars land in the Telegram account.
    step2Title: 'تُضاف النجوم إلى حساب تيليجرام الخاص بك',
    step2Body: 'يستغرق الأمر عادةً بضع دقائق. تحقق من رصيدك في تيليجرام ← الإعدادات ← نجومي.',
    // Step 3 — return and pay.
    step3Title: 'عُد وفعّل بريميوم',
    step3Body: (stars: number) => `عُد إلى هذه الصفحة واضغط على «متابعة — ★${stars}». يتم الدفع داخل تيليجرام.`,
    step3BodyGeneric: 'عُد إلى هذه الصفحة واختر خطة. يتم الدفع داخل تيليجرام.',
    doneButton: 'اشتريت النجوم — العودة إلى الدفع',
  },
  swipeLimit: {
    title: 'نفدت سحباتك',
    body: 'الأعضاء المجانيون لديهم 20 سحبة كل 4 ساعات. تُفتح الدفعة التالية عند انتهاء المؤقّت.',
    untilRefill: 'حتى إعادة الشحن',
    pitchTitle: 'سحب بلا حدود',
    pitchBody: 'بريميوم يزيل حد الـ4 ساعات — إضافةً إلى دردشة غير محدودة والمزيد من المزايا.',
    paywallSubtitle: 'اشترك في بريميوم للسحب بلا حدود',
  },
  directChat: {
    title: 'محادثة مباشرة',
    body: 'عادةً لا يمكنك بدء محادثة إلا بعد أن تُعجبا ببعضكما. مع بريميوم يمكنك المراسلة مباشرةً دون إعجاب متبادل.',
    startCta: 'بدء المحادثة',
    goPremiumCta: 'تفعيل بريميوم',
    remaining: (n: number) =>
      `بقيت ${count(n, 'محادثة مباشرة واحدة', 'محادثتان مباشرتان', 'محادثات مباشرة', 'محادثة مباشرة')} اليوم`,
    limitTitle: 'وصلت إلى حد اليوم',
    limitBody: 'بدأت المحادثات المباشرة الـ3 المتاحة اليوم. الوقت المتبقي حتى تجديد الحد:',
    paywallSubtitle: 'مع بريميوم يمكنك المراسلة مباشرةً دون الحاجة إلى إعجاب متبادل.',
  },
  // Onboarding wizard (per design). Genders/prefs arrays keep the code's
  // option order: woman/man/nonbinary and men/women/everyone.
  onboarding: {
    nameQ: 'ما اسمك؟',
    namePlaceholder: 'تينا',
    nameNoDigits: 'لا يمكن أن يحتوي الاسم على أرقام.',
    useTelegramName: 'استخدام اسم تيليجرام',
    cityQ: 'في أي مدينة تعيش؟',
    cityPlaceholder: 'طهران',
    cityNoDigits: 'لا يمكن أن يحتوي اسم المدينة على أرقام.',
    cityTooLong: 'يجب ألا يزيد اسم المدينة عن 40 حرفًا.',
    cityInvalid: 'أدخل اسم المدينة كاملًا.',
    ageQ: 'كم عمرك؟',
    ageMin: 'يجب أن يكون عمرك 18 عامًا على الأقل.',
    iAm: 'أنا …',
    genders: ['امرأة', 'رجل', 'غير ذلك'],
    interestedIn: 'مهتم بـ…',
    prefOptions: ['رجال', 'نساء', 'الجميع'],
    pickInterests: 'اختر اهتماماتك',
    tagCount: (n: number) => `${n}/5 مختارة · 3 على الأقل`,
    interestsMin: 'اختر 3 على الأقل للمتابعة.',
    photoBio: 'أضف صورة ونبذة',
    resizing: 'جارٍ تغيير الحجم…',
    added: 'تمت الإضافة ✓',
    useTelegramPhoto: 'استخدام صورة تيليجرام',
    telegramPhotoFailed: 'تعذّر جلب صورة تيليجرام. يرجى اختيار صورة.',
    bioPlaceholder: 'اكتب نبذة قصيرة…',
    realPhotos:
      'استخدم صورًا حقيقية لك. الملفات ذات الصور المزيفة قد يبلّغ عنها الآخرون وتُحظر.',
    realPhotosWomen:
      'لا تقلقي 💛 لوما مبني مع التركيز على أمان النساء، وملفك الشخصي لا يظهر في أي مكان خارج التطبيق. ثقي بنا وضعي صورة حقيقية لك لتتضاعف فرصك في التعارف.',
    pauseNote: 'يمكنك إيقاف حسابك مؤقتًا أو حذفه في أي وقت من الإعدادات.',
    enter: 'الدخول إلى لوما',
    continue: 'متابعة',
    error: (msg: string) => `خطأ: ${msg}`,
  },
  // The 16 interest tags — the single shared source for both the Onboarding
  // picker and the MyProfile tag picker. Same emoji and order as fa.ts
  // (Wine → 🍵 Tea, remapped for the Iranian audience).
  interests: [
    '☕ قهوة', '✈️ سفر', '🎵 موسيقى', '🎨 فن',
    '📚 كتب', '🥾 تسلّق', '🍳 طبخ', '🎬 أفلام',
    '🐕 كلاب', '🏄 ركوب الأمواج', '💃 رقص', '🎸 غيتار',
    '🍵 شاي', '🧘 يوغا', '📷 تصوير', '🎮 ألعاب',
  ],
  // Icebreaker prompts + coaching hints for the MyProfile picker. Order is
  // paired 1:1 with the icon list in MyProfile. The prompt text is stored
  // verbatim on the profile.
  icebreakers: [
    { prompt: 'يوم الجمعة المثالي بالنسبة لي…', hint: 'ارسم المشهد — سهل التخيّل، سهل الرد عليه.', question: 'كيف يبدو يوم الجمعة المثالي بالنسبة لك؟' },
    { prompt: 'حقيقتان وكذبة…', hint: 'دعهم يخمّنون — نسبة ردود ممتازة.', question: 'هل تستطيع تخمين أيّها الكذبة؟' },
    { prompt: 'الطريق إلى قلبي…', hint: 'كن محددًا، لا رومانسيًا.', question: 'وما الطريق إلى قلبك أنت؟' },
    { prompt: 'شيء أعشقه بجنون…', hint: 'ذلك الشيء الذي تتحدث عنه أكثر من اللازم.', question: 'ما الشيء الذي تعشقه بجنون؟' },
    { prompt: 'الموعد الأول المثالي…', hint: 'مكان حقيقي، لا «أي مكان معك».', question: 'ما هو الموعد الأول المثالي في رأيك؟' },
    { prompt: 'أكثر آرائي إثارةً للجدل…', hint: 'أبقِه خفيفًا — بمستوى الأناناس على البيتزا.', question: 'هل توافق أم تعارض؟' },
    { prompt: 'سننسجم معًا إذا…', hint: 'اعثر على من يشبهونك.', question: 'هل تظن أننا سننسجم؟' },
    { prompt: 'صباح هادئ أم جدول مزدحم؟', hint: 'خيار بسيط بين اثنين — إجابته تقول الكثير.', question: 'وأنت — صباح هادئ أم جدول مزدحم؟' },
    { prompt: 'مهارتي الغريبة…', hint: 'قليل من التباهي الظريف يفعل الكثير.', question: 'ما هي مهارتك الغريبة؟' },
    { prompt: 'الرحلة التي سآخذك إليها…', hint: 'نفحة مغامرة — إلى أين سنذهب؟', question: 'هل ستأتي معي؟' },
    { prompt: 'آخر شيء أضحكني…', hint: 'أظهر حسّ الفكاهة لديك.', question: 'ما آخر شيء أضحكك؟' },
    { prompt: 'العلامات الإيجابية التي أبحث عنها…', hint: 'قل ما يهمك حقًا.', question: 'ما العلامات الإيجابية التي تبحث عنها؟' },
  ],
  // MyProfile-only strings — field labels shared with the design live in
  // `profile` above; these are the extras the screen needs.
  myProfile: {
    primary: 'الرئيسية',
    nameRequired: 'لا يمكن ترك الاسم فارغًا.',
    ageRequired: 'لا يمكن ترك العمر فارغًا.',
    locationRequired: 'لا يمكن ترك الموقع فارغًا.',
    interestsLabel: 'الاهتمامات',
    genderLabel: 'الجنس',
    lookingForLabel: 'أبحث عن',
    locationPlaceholder: 'المدينة',
    tagDone: '− تم',
    change: 'تغيير',
    answerPlaceholder: 'إجابتك…',
    supportSub: 'سؤال، مشكلة، ملاحظة — نردّ عليك.',
    pickerTitle: 'اختر كاسر جليد',
    photoSheetTitle: 'الصورة',
    changePhoto: 'تغيير الصورة',
    setPrimary: 'تعيين كصورة رئيسية',
    deletePhotoAction: 'حذف الصورة',
    lastPhotoHint: 'يجب أن تكون لديك صورة واحدة على الأقل',
  },
  settings: {
    title: 'الإعدادات',
    darkTheme: 'المظهر الداكن',
    pause: 'إيقاف حسابي مؤقتًا',
    pauseHint: 'لن تظهر في الاكتشاف. توافقاتك الحالية ما زال بإمكانها التواصل معك.',
    dangerZone: 'منطقة الخطر',
    deleteAccount: 'حذف حسابي',
    confirmTitle: 'حذف حسابك؟',
    confirmBody:
      'هذا الإجراء دائم. ستُحذف من الاكتشاف، وستفقد توافقاتك التواصل معك، وستُمحى كل صورك ومعلومات ملفك الشخصي.',
    confirmDelete: 'نعم، احذف حسابي',
    deleting: 'جارٍ الحذف…',
    cancel: 'إلغاء',
    error: 'حدث خطأ ما. يرجى المحاولة مجددًا.',
  },
  // First-open language picker + the Settings row.
  language: {
    title: 'اختر لغتك',
    subtitle: 'يمكنك تغييرها لاحقًا من الإعدادات.',
    continue: 'متابعة',
    settingsLabel: 'اللغة',
  },
  photoEditor: {
    cancel: 'إلغاء',
    rotate: 'تدوير',
    rotateAria: 'تدوير 90 درجة',
    use: 'استخدام الصورة',
    saving: 'جارٍ الحفظ…',
    error: 'تعذّرت معالجة هذه الصورة. يرجى المحاولة مجددًا.',
  },
  photoGrid: {
    onlyImages: 'ملفات الصور فقط مسموح بها',
    tooLarge: 'يجب أن يكون حجم الصورة أقل من 20 ميغابايت',
    uploadFailed: 'فشل الرفع — حاول مجددًا',
  },
  // Fullscreen photo viewer.
  viewer: {
    counter: (i: number, n: number) => `${i} من ${n}`,
  },
  reconnect: {
    title: 'تعذّرت إعادة الاتصال',
    body: 'حدث خطأ أثناء تحميل حسابك. إذا استمرت المشكلة، أغلق لوما من تيليجرام وافتحه مجددًا.',
    retry: 'إعادة المحاولة',
  },
  // Relative time + date words. Numbers are interpolated directly with Latin
  // digits; the formatting logic itself stays in the callers (Task 4).
  // Duals after «منذ» take the genitive (يومين، ساعتين…).
  time: {
    justNow: 'الآن',
    minutesAgo: (n: number) => `منذ ${count(n, 'دقيقة', 'دقيقتين', 'دقائق', 'دقيقة')}`,
    hoursAgo: (n: number) => `منذ ${count(n, 'ساعة', 'ساعتين', 'ساعات', 'ساعة')}`,
    daysAgo: (n: number) => `منذ ${count(n, 'يوم', 'يومين', 'أيام', 'يومًا')}`,
    weeksAgo: (n: number) => `منذ ${count(n, 'أسبوع', 'أسبوعين', 'أسابيع', 'أسبوعًا')}`,
    monthsAgo: (n: number) => `منذ ${count(n, 'شهر', 'شهرين', 'أشهر', 'شهرًا')}`,
    today: 'اليوم',
    yesterday: 'أمس',
  },
  // Screen-reader / aria labels.
  aria: {
    back: 'رجوع',
    close: 'إغلاق',
    settings: 'الإعدادات',
    like: 'إعجاب',
    pass: 'تخطّي',
    rewind: 'العودة إلى الملف السابق',
    deletePhoto: 'حذف الصورة',
    remove: 'إزالة',
    messages: 'الرسائل',
    seen: 'تمت القراءة',
    sent: 'تم الإرسال',
    you: 'أنت',
    photoN: (n: number) => `الصورة ${n}`,
    openChatWith: (name: string) => `فتح الدردشة مع ${name}`,
    directChat: 'بدء محادثة مباشرة',
  },
  referral: {
    sheetTitle: 'دعوة الأصدقاء',
    entryTitle: 'ادعُ أصدقاءك واحصل على اشتراك مجاني',
    entrySub: 'مع 3 أصدقاء تحصل على 3 أيام من بريميوم هدية',
    headlineDefault: 'مع كل دعوة تقترب أكثر من بريميوم',
    headlineReward: 'تقدّمت خطوة أخرى',
    headlineComplete: 'حصلت على كل المكافآت',
    subFresh: 'أرسل رابطك؛ أول صديق ينضم يفتح لك 20 سحبة اكتشاف إضافية.',
    subProgress: 'أرسل رابطك واصعد درجة مع كل صديق ينضم.',
    subReward: 'مكافأة هذه المرحلة أُضيفت إلى حسابك.',
    subComplete: 'شكرًا لأنك تعرّف أصدقاءك على لوما 💛',
    progressFresh: 'لم تُسجَّل أي دعوة بعد',
    progressOf: (n: number, m: number) => `انضم ${n} من أصل ${m} أصدقاء`,
    progressDone: (n: number) => `انضم ${friends(n)}`,
    stage: (s: number) => `المرحلة ${s} من 3`,
    stageComplete: 'اكتملت المراحل الـ3',
    friendCount: (n: number) => friends(n),
    tierSwipes: (n: number) => extraSwipes(n),
    tierPremium: (d: number) => `${days(d)} من بريميوم`,
    chipDone: 'حصلت عليها',
    chipJustDone: 'حصلت عليها للتو',
    chipRemaining: (n: number) => moreFriends(n),
    rewardBannerPremium: (d: number) => `حصلت على ${days(d)} من بريميوم! 🎉`,
    rewardBannerSwipes: (n: number) => `حصلت على ${extraSwipes(n)}! 🎉`,
    rewardBannerUntil: (date: string) => `مفعّل الآن — حتى ${date}`,
    rewardBannerAdded: 'أُضيف إلى حسابك للتو',
    continueCta: 'تابع',
    nextTierNote: (n: number, reward: string) => `${moreFriends(n)} حتى ${reward}`,
    inviteCta: 'دعوة الأصدقاء',
    copyAria: 'نسخ الرابط',
    footnote: 'تُحتسب الدعوة عندما يسجّل صديقك ويضيف صورة ملف شخصي.',
    paywallPromo: 'أو ادعُ 3 أصدقاء واحصل على 3 أيام مجانًا',
  },
} satisfies Messages
