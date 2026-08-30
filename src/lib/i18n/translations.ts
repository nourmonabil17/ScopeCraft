// src/lib/i18n/translations.ts
//
// Bilingual dictionary (English / Arabic).
//
// `TranslationKey` is derived from the English dictionary, and `ar` is typed as
// `Record<TranslationKey, string>` — so adding an English key without an Arabic
// one is a compile error, not a silently-untranslated string in production.
//
// Arabic here is Modern Standard Arabic, matching the register of the English
// copy (product/agile vocabulary, not colloquial). MoSCoW terms use the
// conventional Arabic agile renderings: يجب / ينبغي / يمكن / لن ينفذ.

export const LOCALES = ["en", "ar"] as const;
export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Text direction per locale. Arabic is the only RTL locale here. */
export function directionFor(locale: Locale): "ltr" | "rtl" {
  return locale === "ar" ? "rtl" : "ltr";
}

const en = {
  // ---- Header / navigation ----
  "app.name": "ScopeCraft",
  "app.tagline":
    "Turn a product idea into a structured PRD, user stories, risks, and a capacity-bounded sprint plan.",
  "header.skipToContent": "Skip to main content",
  "header.status.live": "Live",
  "header.status.description": "Deployed and running",
  "header.reset": "New PRD",
  "header.reset.description": "Clear the current result and start over",
  "header.signOut": "Sign out",
  "header.theme.toggle": "Switch theme",
  "header.theme.light": "Light",
  "header.theme.dark": "Dark",
  "header.theme.system": "System",
  "header.language.toggle": "Change language",
  "header.language.en": "English",
  "header.language.ar": "العربية",
  "nav.home": "Home",

  // ---- Sign-in ----
  "login.heading": "Sign in to ScopeCraft",
  "login.subtitle":
    "ScopeCraft turns a product idea into a PRD, user stories, risks, and a capacity-bounded sprint plan. Sign in to get started.",
  "login.github": "Continue with GitHub",
  "login.google": "Continue with Google",
  "login.redirecting": "Redirecting to GitHub…",
  "login.redirecting.google": "Redirecting to Google…",
  "login.note":
    "ScopeCraft never sees your GitHub or Google password. It receives only your name, email address, and avatar.",

  // ---- Intake wizard ----
  "form.heading": "Describe your product",
  "form.presets.legend": "Start from an example (optional)",
  "form.presets.apply": "Fill the form with the {label} example: {description}",
  // The whole badge, not just its unit: Arabic wants the day marker written out
  // rather than an English "d", and a bare literal in JSX cannot be type-checked
  // for a missing translation the way a key can.
  "form.presets.meta": "{points} · {days}d",
  "form.presets.applied": "{label} preset applied. The form is ready to submit.",
  "preset.capstone.label": "Student capstone",
  "preset.capstone.description":
    "A collaborative study platform, sized for a team of four junior developers on two-week sprints.",
  "preset.developerTool.label": "Developer tool",
  "preset.developerTool.description":
    "A Next.js bundle analyzer with a CLI and dashboard, constrained by CI runtime.",
  "preset.mobileMvp.label": "Mobile MVP",
  "preset.mobileMvp.description":
    "An offline-first habit tracker for a small mobile team on a one-week cadence.",
  "form.idea.label": "Product idea",
  "form.idea.required": "(required)",
  "form.idea.hint":
    "Describe what you want to build and who it is for. At least {min} characters.",
  "form.idea.moreNeeded": "{count} more needed",
  "form.constraints.label": "Constraints",
  "form.constraints.optional": "(optional)",
  "form.constraints.hint":
    "Team size, timeline, budget, or anything the plan must work around.",
  "form.capacity.label": "Team capacity",
  "form.capacity.hint": "Story points your team completes per sprint ({min}–{max}).",
  "form.capacity.slider": "Team capacity slider",
  "form.sprintLength.label": "Sprint length",
  "form.sprintLength.hint": "Days per sprint ({min}–{max}).",
  "form.submit": "Generate plan",
  "form.submit.loading": "Generating plan…",
  "form.clear": "Clear",
  "form.cleared": "Form cleared.",
  "form.errors.one": "There is 1 problem with this form",
  "form.errors.many": "There are {count} problems with this form",

  // ---- Validation messages ----
  "validation.idea.required": "Product idea is required.",
  "validation.idea.tooShort": "Product idea must be at least {min} characters long.",
  "validation.idea.tooLong": "Product idea must be {max} characters or fewer.",
  "validation.constraints.tooLong": "Constraints must be {max} characters or fewer.",
  "validation.capacity.integer": "Team capacity must be a whole number.",
  "validation.capacity.range": "Team capacity must be between {min} and {max} points.",
  "validation.sprintLength.integer": "Sprint length must be a whole number.",
  "validation.sprintLength.range": "Sprint length must be between {min} and {max} days.",

  // ---- UI states ----
  "state.loading.label": "Generating your plan",
  "state.loading.step1": "Validating your request",
  "state.loading.step2": "Contacting the AI provider",
  "state.loading.step3": "Structuring your PRD",
  "state.loading.step4": "Calculating priority, MoSCoW, and sprint capacity",
  "state.empty.heading": "Results cleared",
  "state.empty.body":
    "Nothing generated yet. Describe a product idea above, or pick a starter preset, and select Generate plan.",
  "state.empty.action": "Scroll to the form",
  "state.refusal.heading": "Outside ScopeCraft's scope",
  "state.refusal.body":
    "Try describing a software product, tool, or app instead — what it does and who it's for.",
  "state.refusal.action": "Edit my idea",
  "state.validation.action": "Fix and try again",
  "state.error.retry": "Retry generation",
  "state.error.network": "Network error. Please check your connection and try again.",
  "state.error.generic": "Something went wrong.",

  // ---- Result view / tabs ----
  "result.heading": "Product requirements",
  "result.tab.overview": "PRD Overview",
  "result.tab.backlog": "Sprint Backlog",
  "result.tab.evidence": "Traceability & Evidence",
  "result.clear": "Clear results",
  "board.saving": "Saving…",
  "board.saved": "Saved",
  "board.saveFailed": "Changes could not be saved",
  "board.saveUnavailable": "Changes will not be saved for this plan",
  "history.title": "Your plans",
  "history.link": "Your plans",
  "history.empty": "You have not generated any plans yet.",
  "history.emptyAction": "Generate a plan and it will appear here.",
  "history.generatedOn": "Generated",
  "history.capacity": "Capacity",
  "history.sprintLength": "Sprint length",
  "history.days": "days",
  "history.points": "points",
  "history.failed": "Generation failed",
  "history.edited": "Edited",
  "history.showing": "Showing your most recent plans.",
  "history.unavailable": "Your plans cannot be loaded right now. Please try again shortly.",
  "history.backToForm": "Back to the plan form",
  "history.detail.backToHistory": "Back to your plans",
  "history.duplicate": "Duplicate",
  "history.duplicate.description": "Fill the form with this plan's idea and constraints",
  "history.delete": "Delete",
  "history.delete.confirm": "Confirm delete?",
  "history.delete.description": "Permanently delete this plan",
  "history.deleteFailed": "This plan could not be deleted. Please try again.",
  "history.stats.plans.one": "1 plan",
  "history.stats.plans.many": "{count} plans",
  "history.stats.avgCapacity": "Average capacity: {avg} pts",
  "landing.heading": "Turn a product idea into a sprint-ready plan.",
  "landing.exampleHeading": "Example output",
  "landing.examplePrd":
    "\"As a student, I want to filter potential study partners by course and availability, so that I can form a compatible group quickly.\" — one of seven user stories generated for a study-group planning app.",
  "landing.cta": "Get started",

  // ---- The 11 PRD fields ----
  "prd.problem": "Problem statement",
  "prd.targetUser": "Target persona",
  "prd.goals": "Goals",
  "prd.nonGoals": "Out of scope",
  "prd.requirements": "Requirements",
  "prd.stories": "User stories, acceptance criteria, priority & effort",
  "prd.acceptanceCriteria": "Overall acceptance criteria",
  "prd.risks": "Risk register",
  "prd.sprintPlan": "Sprint plan",
  "prd.nonGoals.none": "None stated.",
  "prd.story.statement": "As a {asA}, I want {iWant}, so that {soThat}.",
  "prd.story.value": "Value {value}/5",
  "prd.story.risk": "Risk {risk}/5",
  "prd.story.effort": "Effort {points} pts",
  "prd.story.priority": "Priority {score}",
  "prd.story.dependsOn": "Depends on: {ids}",
  "prd.story.acceptanceCriteria": "Acceptance criteria",
  "prd.risk.id": "ID",
  "prd.risk.description": "Description",
  "prd.risk.impact": "Impact",
  "prd.risk.likelihood": "Likelihood",
  "prd.sprint.story": "Story",
  "prd.sprint.priorityScore": "Priority score",
  "prd.sprint.effort": "Effort",
  "prd.sprint.number": "Sprint",
  "prd.sprint.fullSequence": "Full sprint sequence (all sprints, as generated)",
  "prd.disclaimer":
    "Sprint placement reflects story points and priority, not calendar dates. No delivery date is calculated or implied — that decision belongs to your team.",

  // ---- Gherkin ----
  "gherkin.scenario": "Scenario:",
  "gherkin.given": "Given",
  "gherkin.when": "When",
  "gherkin.then": "Then",

  // ---- MoSCoW ----
  "moscow.must": "Must",
  "moscow.should": "Should",
  "moscow.could": "Could",
  "moscow.wont": "Won't",

  // ---- Impact / likelihood ----
  "level.low": "low",
  "level.medium": "medium",
  "level.high": "high",

  // ---- Sprint board ----
  "board.intro":
    "Drag-free, keyboard-operable board below — move a story between sprint 1 and the deferred backlog, or adjust its points, and the capacity math updates instantly. Nothing here calls the AI again.",
  "board.capacity.group": "Sprint capacity",
  "board.capacity.title": "Sprint 1 capacity",
  "board.capacity.numbers": "{committed} / {capacity} points",
  "board.capacity.percent": "{percent}% of capacity",
  "board.capacity.over":
    "{count} points over capacity. Move a story to the deferred backlog.",
  "board.capacity.warning": "{count} points of headroom left.",
  "board.capacity.ok": "{count} points of headroom remaining.",
  "board.announce.over": "Over capacity: {committed} of {capacity} points committed.",
  "board.announce.warning":
    "Nearing capacity: {committed} of {capacity} points committed.",
  "board.announce.ok": "Within capacity: {committed} of {capacity} points committed.",
  "board.column.committed": "Committed to sprint 1",
  "board.column.deferred": "Deferred backlog",
  "board.column.empty.committed": "No stories committed yet.",
  "board.column.empty.deferred": "Nothing deferred.",
  "board.card.statement": "As a {asA}, I want {iWant}.",
  "board.card.score": "Score {score}",
  "board.card.points": "Points",
  "board.card.pointsLabel": "Story points for {id}",
  "board.action.defer": "Defer",
  "board.action.commit": "Commit to sprint",
  "board.action.deferLabel": "Move {id} to the deferred backlog",
  "board.action.commitLabel": "Move {id} to sprint 1",
  "board.dependency.warning":
    "Depends on {id}, which is in the deferred backlog.",

  // ---- Evidence panel ----
  "evidence.heading": "Evidence & provenance",
  "evidence.provider": "AI provider",
  "evidence.promptVersion": "Prompt version",
  "evidence.templateVersion": "Template version",
  "evidence.label.model": "Model",
  "evidence.label.deterministic": "Deterministic",
  "evidence.model.body":
    "Problem statement, target user, goals, requirements, user stories, acceptance criteria, and risks — descriptive prose, validated against a strict schema but not independently fact-checked.",
  "evidence.deterministic.body":
    "Priority score, MoSCoW bucket, and sprint capacity packing are computed by pure functions on the server and again on this page when you edit the board. The model's own estimates for these four fields are discarded before you ever see them; nothing here is asked of, or trusted from, the AI.",
  "evidence.sources": "Grounding sources",
  "evidence.source.scrum": "Sprint, backlog and increment vocabulary",
  "evidence.source.github": "Issue-based backlog tracking conventions",
  "evidence.footer":
    "Scope, priority, and delivery timing remain Product Owner decisions. This tool computes capacity math; it does not commit a team to a date.",

  // ---- Export ----
  "export.copyMarkdown": "Copy PRD as Markdown",
  "export.downloadJson": "Download Backlog JSON",
  "export.copied": "PRD copied to clipboard as Markdown!",
  "export.copyFailed":
    "Couldn't copy automatically. Select and copy the text manually.",
  "export.downloaded": "Backlog JSON exported successfully!",
  "export.downloadFailed": "Couldn't prepare the download. Please try again.",

  // ---- Toast ----
  "toast.dismiss": "Dismiss notification",
  "toast.region": "Notifications",
} as const;

export type TranslationKey = keyof typeof en;

const ar: Record<TranslationKey, string> = {
  // ---- Header / navigation ----
  // The product name is a brand, not prose — it stays "ScopeCraft" in every
  // locale. Transliterating it would give the same product two different
  // names and break recognition against the repo, the URL, and the docs.
  "app.name": "ScopeCraft",
  "app.tagline":
    "حوّل فكرة منتجك إلى وثيقة متطلبات منظمة وقصص مستخدمين ومخاطر وخطة سبرنت محكومة بالسعة.",
  "header.skipToContent": "تخطَّ إلى المحتوى الرئيسي",
  "header.status.live": "مباشر",
  "header.status.description": "منشور وقيد التشغيل",
  "header.reset": "وثيقة جديدة",
  "header.reset.description": "امسح النتيجة الحالية وابدأ من جديد",
  "header.signOut": "تسجيل الخروج",
  "header.theme.toggle": "تبديل المظهر",
  "header.theme.light": "فاتح",
  "header.theme.dark": "داكن",
  // Left in English deliberately: this names the OS-level setting the user
  // would go looking for, which their device presents as "System".
  "header.theme.system": "System",
  "header.language.toggle": "تغيير اللغة",
  "header.language.en": "English",
  "header.language.ar": "العربية",
  "nav.home": "الرئيسية",

  // ---- Sign-in ----
  "login.heading": "تسجيل الدخول إلى ScopeCraft",
  "login.subtitle":
    "يحوّل ScopeCraft فكرة المنتج إلى وثيقة متطلبات وقصص مستخدم ومخاطر وخطة سبرنت مقيّدة بالسعة. سجّل الدخول للبدء.",
  "login.github": "المتابعة عبر GitHub",
  "login.google": "المتابعة عبر Google",
  "login.redirecting": "جارٍ التحويل إلى GitHub…",
  "login.redirecting.google": "جارٍ التحويل إلى Google…",
  "login.note":
    "لا يطّلع ScopeCraft على كلمة مرور GitHub أو Google الخاصة بك، بل يستقبل اسمك وبريدك الإلكتروني وصورتك الرمزية فقط.",

  // ---- Intake wizard ----
  "form.heading": "صف منتجك",
  "form.presets.legend": "ابدأ من مثال (اختياري)",
  "form.presets.apply": "املأ النموذج بمثال {label}: {description}",
  "form.presets.meta": "{points} · {days} يوم",
  "form.presets.applied": "تم تطبيق نموذج {label}. النموذج جاهز للإرسال.",
  "preset.capstone.label": "مشروع تخرج طلابي",
  "preset.capstone.description":
    "منصة دراسة تعاونية، مصممة لفريق من أربعة مطورين مبتدئين بسبرنتات مدتها أسبوعان.",
  "preset.developerTool.label": "أداة للمطورين",
  "preset.developerTool.description":
    "محلل حزم لـNext.js بواجهة سطر أوامر ولوحة تحكم، مقيد بزمن التشغيل في التكامل المستمر.",
  "preset.mobileMvp.label": "منتج أولي للجوال",
  "preset.mobileMvp.description":
    "متتبع عادات يعمل دون اتصال أولًا، لفريق جوال صغير بوتيرة أسبوعية.",
  "form.idea.label": "فكرة المنتج",
  "form.idea.required": "(مطلوب)",
  "form.idea.hint": "صف ما تريد بناءه ولمن هو موجه. {min} حرفًا على الأقل.",
  "form.idea.moreNeeded": "يلزم {count} حرفًا إضافيًا",
  "form.constraints.label": "القيود",
  "form.constraints.optional": "(اختياري)",
  "form.constraints.hint":
    "حجم الفريق أو الجدول الزمني أو الميزانية أو أي قيد يجب أن تراعيه الخطة.",
  "form.capacity.label": "سعة الفريق",
  "form.capacity.hint": "نقاط القصص التي ينجزها فريقك في كل سبرنت ({min}–{max}).",
  "form.capacity.slider": "شريط تمرير سعة الفريق",
  "form.sprintLength.label": "مدة السبرنت",
  "form.sprintLength.hint": "عدد الأيام في كل سبرنت ({min}–{max}).",
  "form.submit": "أنشئ الخطة",
  "form.submit.loading": "جارٍ إنشاء الخطة…",
  "form.clear": "مسح",
  "form.cleared": "تم مسح النموذج.",
  "form.errors.one": "توجد مشكلة واحدة في هذا النموذج",
  "form.errors.many": "توجد {count} مشكلات في هذا النموذج",

  // ---- Validation messages ----
  "validation.idea.required": "فكرة المنتج مطلوبة.",
  "validation.idea.tooShort": "يجب ألا تقل فكرة المنتج عن {min} حرفًا.",
  "validation.idea.tooLong": "يجب ألا تزيد فكرة المنتج عن {max} حرفًا.",
  "validation.constraints.tooLong": "يجب ألا تزيد القيود عن {max} حرفًا.",
  "validation.capacity.integer": "يجب أن تكون سعة الفريق عددًا صحيحًا.",
  "validation.capacity.range": "يجب أن تتراوح سعة الفريق بين {min} و{max} نقطة.",
  "validation.sprintLength.integer": "يجب أن تكون مدة السبرنت عددًا صحيحًا.",
  "validation.sprintLength.range": "يجب أن تتراوح مدة السبرنت بين {min} و{max} يومًا.",

  // ---- UI states ----
  "state.loading.label": "جارٍ إنشاء خطتك",
  "state.loading.step1": "جارٍ التحقق من طلبك",
  "state.loading.step2": "جارٍ الاتصال بمزود الذكاء الاصطناعي",
  "state.loading.step3": "جارٍ هيكلة وثيقة المتطلبات",
  "state.loading.step4": "جارٍ حساب الأولوية وتصنيف MoSCoW وسعة السبرنت",
  "state.empty.heading": "تم مسح النتائج",
  "state.empty.body":
    "لم يتم إنشاء أي شيء بعد. صف فكرة منتج أعلاه، أو اختر مثالًا جاهزًا، ثم اضغط أنشئ الخطة.",
  "state.empty.action": "انتقل إلى النموذج",
  "state.refusal.heading": "خارج نطاق سكوب كرافت",
  "state.refusal.body":
    "جرّب وصف منتج برمجي أو أداة أو تطبيق بدلًا من ذلك — ما الذي يفعله ولمن هو موجه.",
  "state.refusal.action": "تعديل فكرتي",
  "state.validation.action": "صحّح وحاول مجددًا",
  "state.error.retry": "إعادة المحاولة",
  "state.error.network": "خطأ في الشبكة. تحقق من اتصالك وحاول مرة أخرى.",
  "state.error.generic": "حدث خطأ ما.",

  // ---- Result view / tabs ----
  "result.heading": "متطلبات المنتج",
  "result.tab.overview": "نظرة عامة",
  "result.tab.backlog": "قائمة أعمال السبرنت",
  "result.tab.evidence": "التتبع والأدلة",
  "result.clear": "مسح النتائج",
  "board.saving": "جارٍ الحفظ…",
  "board.saved": "تم الحفظ",
  "board.saveFailed": "تعذّر حفظ التغييرات",
  "board.saveUnavailable": "لن يتم حفظ التغييرات لهذه الخطة",
  "history.title": "خططك",
  "history.link": "خططك",
  "history.empty": "لم تُنشئ أي خطط بعد.",
  "history.emptyAction": "أنشئ خطة وستظهر هنا.",
  "history.generatedOn": "أُنشئت",
  "history.capacity": "السعة",
  "history.sprintLength": "طول السبرنت",
  "history.days": "أيام",
  "history.points": "نقطة",
  "history.failed": "فشل الإنشاء",
  "history.edited": "مُعدَّلة",
  "history.showing": "يتم عرض أحدث خططك.",
  "history.unavailable": "تعذّر تحميل خططك الآن. يُرجى المحاولة بعد قليل.",
  "history.backToForm": "العودة إلى نموذج الخطة",
  "history.detail.backToHistory": "العودة إلى خططك",
  "history.duplicate": "نسخ",
  "history.duplicate.description": "املأ النموذج بفكرة هذه الخطة وقيودها",
  "history.delete": "حذف",
  "history.delete.confirm": "تأكيد الحذف؟",
  "history.delete.description": "حذف هذه الخطة نهائيًا",
  "history.deleteFailed": "تعذّر حذف هذه الخطة. يُرجى المحاولة مرة أخرى.",
  "history.stats.plans.one": "خطة واحدة",
  "history.stats.plans.many": "{count} خطة",
  "history.stats.avgCapacity": "متوسط السعة: {avg} نقطة",
  "landing.heading": "حوّل فكرة منتجك إلى خطة جاهزة للسبرنت.",
  "landing.exampleHeading": "مثال على الناتج",
  "landing.examplePrd":
    "«بصفتي طالبًا، أريد تصفية شركاء الدراسة المحتملين حسب المقرر والتوافر، لأتمكن من تكوين مجموعة متوافقة بسرعة.» — إحدى سبع قصص مستخدم أُنشئت لتطبيق لتخطيط مجموعات الدراسة.",
  "landing.cta": "ابدأ الآن",

  // ---- The 11 PRD fields ----
  "prd.problem": "بيان المشكلة",
  "prd.targetUser": "الشخصية المستهدفة",
  "prd.goals": "الأهداف",
  "prd.nonGoals": "خارج النطاق",
  "prd.requirements": "المتطلبات",
  "prd.stories": "قصص المستخدمين ومعايير القبول والأولوية والجهد",
  "prd.acceptanceCriteria": "معايير القبول العامة",
  "prd.risks": "سجل المخاطر",
  "prd.sprintPlan": "خطة السبرنت",
  "prd.nonGoals.none": "لا يوجد.",
  "prd.story.statement": "بصفتي {asA}، أريد {iWant}، حتى {soThat}.",
  "prd.story.value": "القيمة {value}/5",
  "prd.story.risk": "المخاطرة {risk}/5",
  "prd.story.effort": "الجهد {points} نقطة",
  "prd.story.priority": "الأولوية {score}",
  "prd.story.dependsOn": "يعتمد على: {ids}",
  "prd.story.acceptanceCriteria": "معايير القبول",
  "prd.risk.id": "المعرف",
  "prd.risk.description": "الوصف",
  "prd.risk.impact": "الأثر",
  "prd.risk.likelihood": "الاحتمالية",
  "prd.sprint.story": "القصة",
  "prd.sprint.priorityScore": "درجة الأولوية",
  "prd.sprint.effort": "الجهد",
  "prd.sprint.number": "السبرنت",
  "prd.sprint.fullSequence": "تسلسل السبرنت الكامل (كل السبرنتات كما أُنشئت)",
  "prd.disclaimer":
    "يعكس توزيع السبرنت نقاط القصص والأولوية، لا التواريخ. لا يتم حساب أو تضمين أي تاريخ تسليم — فهذا قرار يخص فريقك.",

  // ---- Gherkin ----
  "gherkin.scenario": "السيناريو:",
  "gherkin.given": "بفرض",
  "gherkin.when": "عندما",
  "gherkin.then": "إذن",

  // ---- MoSCoW ----
  "moscow.must": "يجب",
  "moscow.should": "ينبغي",
  "moscow.could": "يمكن",
  "moscow.wont": "لن ينفذ",

  // ---- Impact / likelihood ----
  "level.low": "منخفض",
  "level.medium": "متوسط",
  "level.high": "مرتفع",

  // ---- Sprint board ----
  "board.intro":
    "لوحة تعمل بالكامل عبر لوحة المفاتيح دون سحب وإفلات — انقل قصة بين السبرنت الأول وقائمة الأعمال المؤجلة، أو عدّل نقاطها، وستتحدث حسابات السعة فورًا. لا شيء هنا يستدعي الذكاء الاصطناعي مجددًا.",
  "board.capacity.group": "سعة السبرنت",
  "board.capacity.title": "سعة السبرنت الأول",
  "board.capacity.numbers": "{committed} / {capacity} نقطة",
  "board.capacity.percent": "{percent}٪ من السعة",
  "board.capacity.over": "تجاوزت السعة بمقدار {count} نقطة. انقل قصة إلى قائمة الأعمال المؤجلة.",
  "board.capacity.warning": "تبقى {count} نقطة من السعة.",
  "board.capacity.ok": "تبقى {count} نقطة من السعة.",
  "board.announce.over": "تجاوز السعة: تم الالتزام بـ{committed} من {capacity} نقطة.",
  "board.announce.warning": "اقتراب من السعة: تم الالتزام بـ{committed} من {capacity} نقطة.",
  "board.announce.ok": "ضمن السعة: تم الالتزام بـ{committed} من {capacity} نقطة.",
  "board.column.committed": "ملتزم به في السبرنت الأول",
  "board.column.deferred": "قائمة الأعمال المؤجلة",
  "board.column.empty.committed": "لا توجد قصص ملتزم بها بعد.",
  "board.column.empty.deferred": "لا يوجد شيء مؤجل.",
  "board.card.statement": "بصفتي {asA}، أريد {iWant}.",
  "board.card.score": "الدرجة {score}",
  "board.card.points": "النقاط",
  "board.card.pointsLabel": "نقاط القصة لـ{id}",
  "board.action.defer": "تأجيل",
  "board.action.commit": "الالتزام بالسبرنت",
  "board.action.deferLabel": "انقل {id} إلى قائمة الأعمال المؤجلة",
  "board.action.commitLabel": "انقل {id} إلى السبرنت الأول",
  "board.dependency.warning": "يعتمد على {id}، وهي في قائمة الأعمال المؤجلة.",

  // ---- Evidence panel ----
  "evidence.heading": "الأدلة والمصادر",
  "evidence.provider": "مزود الذكاء الاصطناعي",
  "evidence.promptVersion": "إصدار التوجيه",
  "evidence.templateVersion": "إصدار القالب",
  "evidence.label.model": "النموذج",
  "evidence.label.deterministic": "حتمي",
  "evidence.model.body":
    "بيان المشكلة والمستخدم المستهدف والأهداف والمتطلبات وقصص المستخدمين ومعايير القبول والمخاطر — نصوص وصفية تم التحقق من بنيتها وفق مخطط صارم، لكن لم يتم التحقق من صحة محتواها بشكل مستقل.",
  "evidence.deterministic.body":
    "درجة الأولوية وتصنيف MoSCoW وتوزيع سعة السبرنت تُحسب بدوال خالصة على الخادم، ثم تُحسب مرة أخرى في هذه الصفحة عند تعديل اللوحة. تُهمل تقديرات النموذج لهذه الحقول الأربعة قبل عرضها عليك؛ لا شيء هنا مأخوذ عن الذكاء الاصطناعي أو موثوق منه.",
  "evidence.sources": "مصادر الإسناد",
  "evidence.source.scrum": "مصطلحات السبرنت وقائمة الأعمال والزيادة",
  "evidence.source.github": "أعراف تتبع قائمة الأعمال عبر المهام",
  "evidence.footer":
    "يظل النطاق والأولوية وتوقيت التسليم قرارات تخص مالك المنتج. تحسب هذه الأداة رياضيات السعة فقط؛ ولا تُلزم الفريق بتاريخ محدد.",

  // ---- Export ----
  "export.copyMarkdown": "نسخ الوثيقة بصيغة Markdown",
  "export.downloadJson": "تنزيل قائمة الأعمال JSON",
  "export.copied": "تم نسخ الوثيقة إلى الحافظة بصيغة Markdown!",
  "export.copyFailed": "تعذر النسخ تلقائيًا. حدد النص وانسخه يدويًا.",
  "export.downloaded": "تم تصدير قائمة الأعمال JSON بنجاح!",
  "export.downloadFailed": "تعذر تجهيز التنزيل. حاول مرة أخرى.",

  // ---- Toast ----
  "toast.dismiss": "إغلاق الإشعار",
  "toast.region": "الإشعارات",
};

export const TRANSLATIONS: Record<Locale, Record<TranslationKey, string>> = {
  en,
  ar,
};

/**
 * Substitutes `{name}` placeholders. Values are stringified as-is — this is
 * plain text interpolation into React children, never HTML, so there is no
 * markup to escape.
 */
export function interpolate(
  template: string,
  values?: Record<string, string | number>
): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in values ? String(values[key]) : match
  );
}

/** Standalone lookup, for callers outside React (tests, pure formatters). */
export function translate(
  locale: Locale,
  key: TranslationKey,
  values?: Record<string, string | number>
): string {
  return interpolate(TRANSLATIONS[locale][key], values);
}
