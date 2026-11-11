<div dir="rtl">

# إحنا عملنا إيه لحد دلوقتي

آخر تحديث: 2026-11-11. وقت القراية: حوالي 30 دقيقة. كل مصطلح مهم ليه كارت قصير في `learn/`، والروابط موجودة جوه الكلام.

## 1. الخلاصة

بنبني **لعبة اجتماعية عن كورة القدم**: توقعات ماتشات، تصويت رجل المباراة، ومعارك أسئلة أونلاين. الكور بتاع اللعبة هو المعارك.

اللي خلص لحد دلوقتي هو **الأساس اللي اللعبة هتتبني فوقه**، مش اللعبة نفسها:

- سيرفر شغال بقاعدة بيانات و Redis وعمليات في الخلفية.
- تسجيل دخول بجوجل، وإدارة الأجهزة والحساب.
- داتا كورة وهمية كاملة: بطولات وفرق ولعيبة وماتشات، بالعربي والإنجليزي.
- أداة تتحكم بيها في أي ماتش من التيرمينال، وتلعب يوم ماتشات كامل في ثواني.
- تسجيل التوقعات لحد الكيك أوف.
- داتا كورة حقيقية من Wikidata (21 ألف لاعب ومسيرتهم بالعربي والإنجليزي)، ومنها أسئلة متولدة لوحدها، وبنك أسئلة في الباك إند بيختار ويصحح.
- أساس تطبيق الموبايل (Flutter).

لسه ما اتبناش: المعارك نفسها (الـ engine)، النقط، الترتيب، الغرف، الصحاب، الدوريات الخاصة، وشاشات اللعب في الموبايل.

## 2. الحالة دلوقتي

| الجزء | فيه إيه | الحالة |
|---|---|---|
| التوثيق والقرارات | PRD، المعمارية، الـ API، الـ ADRs | في `main` |
| **P0** الأساس | NestJS، Postgres، Redis، Outbox، CI | في `main` |
| **P1** الحسابات | جوجل، الجلسات، البروفايل، حذف الحساب | في `main` |
| **P2.1** قراءة الكورة | البطولات والماتشات بالعربي والإنجليزي | في `main` |
| **P2.2** داتا وهمية ودورة حياة الماتش | Mock provider، state machine، مزامنة كل ساعة | في `main` |
| الغرف متعددة اللاعبين | قرار مكتوب في DEC-38، والكود في P8 | في `main` |
| **P2.3** المحاكي | أوامر `mock:*` | في `main` |
| **P3.1** التوقعات | تسجيل وتعديل التوقع لحد الكيك أوف | في `main` |
| **P5.1** استيراد الأسئلة | `questions:import`، النسخ، المراجعة | في `main` |
| **G0** أنواع الألعاب | Buzzer، Career، Who is the player?، Grid، Imposter (ADR-0015) | في `main` |
| **D.1** داتا Wikidata | `football_kb`: لعيبة وأندية ومسيرة وأسامي عربي | في `main` |
| **P5.2** الكتالوج والجولات | استيراد، اختيار، تصحيح، `GET /v1/answer-catalog` | في `main` |
| **M0** الموبايل | Flutter، Riverpod، go_router، client متولد | في `main` |
| **D.2a** أول أسئلة متولدة | `kb bundle` و `dev-0002` | [PR #31](https://github.com/the-game22027/the-game/pull/31) مستني `merge` |

الأرقام (الباك إند): 267 unit test و 108 integration test و 79 e2e test. والـ Python: 69 test.

## 3. الصورة الكبيرة

الكود مشروع واحد، لكنه بيشتغل كـ **3 عمليات منفصلة**. كل واحدة ليها ملف `main` بيختار الموديولات اللي محتاجها:

<div dir="ltr">

```text
Mobile app (not built yet)
      |  HTTP + WebSocket
      v
+-------------+        +--------------+        +----------------+
|  API        |        |  Worker      |        |  CLI           |
|  main.api   |        |  main.worker |        |  main.cli      |
|  requests   |        |  background  |        |  dev commands  |
+------+------+        +------+-------+        +-------+--------+
       |                      |                        |
       +----------+-----------+------------------------+
                  v                       v
            PostgreSQL                  Redis
         (source of truth)     (queues, rate limits)
```

</div>

- **API:** بيرد على طلبات التطبيق. لازم يفضل سريع.
- **Worker:** الشغل التقيل والمتأخر، زي مزامنة الماتشات ونشر الأحداث. لو اتحط جوه الـ API هياخد من سرعة الرد على اللعيبة.
- **CLI:** أوامر للمطور بس، ومش موجودة في الـ production.

لو جاي من الموبايل: فكر في الـ API كأنه الـ UI thread، والـ Worker كأنه background service.

## 4. الكود متقسم إزاي

### Modular monolith

برنامج واحد بيتعمله deploy مرة واحدة، لكن جواه موديولات بحيطان صارمة: `auth` و `users` و `football`. اخترنا كده بدل microservices عشان إحنا شخص واحد وميزانية صفر، وكل microservice زيادة معناها deploy و monitoring ومشاكل شبكة زيادة. التفاصيل في [modular-monolith](architecture/modular-monolith.md).

القاعدة: موديول ما يلمسش جوه موديول تاني. بيتعامل بس مع `index.ts` بتاعه. الأمر `npm run depcheck:boundaries` بيوقع الـ CI لو حد كسر القاعدة.

### الطبقات جوه كل موديول

| الطبقة | وظيفتها | مثال عندنا |
|---|---|---|
| `presentation` | تستقبل الطلب وتتأكد من شكله | `football.controller.ts` |
| `application` | تنسق خطوات العملية | `apply-provider-match-update.ts` |
| `domain` | قواعد البيزنس الصافية، بدون أي framework | `match-lifecycle.ts` |
| `infrastructure` | Prisma والحاجات الخارجية | `prisma-match-write.repository.ts` |

ليه؟ الـ `domain` ممكن يتختبر في ملي ثانية من غير داتابيز، وتغيير المكتبات ما يلمسش القواعد. الـ `application` بيعرّف **port** (واجهة)، والـ `infrastructure` بينفذها. عشان كده لما نجيب داتا كورة حقيقية هنكتب class واحد جديد مكان `MockFootballProvider`. اقرا [layers-and-ports](architecture/layers-and-ports.md).

## 5. P0: الأساس

| الحاجة | بتحل إيه | الكارت |
|---|---|---|
| **Migrations** | تغييرات الداتابيز متسجلة زي الكود، وكل واحد يوصل لنفس الشكل | [migrations](database/migrations.md) |
| **Fail-fast config** | إعداد غلط يوقف السيرفر وقت التشغيل، مش الساعة 3 الفجر | [fail-fast-config](backend/fail-fast-config.md) |
| **Errors موحدة** | الـ domain يقول "النوع" (`CONFLICT`)، وفلتر واحد يحوله لـ HTTP | [errors-problem-details](backend/errors-problem-details.md) |
| **Request ID** | رقم واحد يربط كل سطور اللوج بتاعة نفس الطلب | [request-id-and-logs](backend/request-id-and-logs.md) |
| **Health checks** | `/health/live` العملية شغالة، و `/health/ready` جاهزة تستقبل | [health-checks](devops/health-checks.md) |
| **Metrics** | `/metrics` أرقام تقدر تتابعها بـ Prometheus و Grafana | |
| **CI** | كل PR لازم يثبت إن الكود لسه شغال | [ci](devops/ci.md) |

### أهم فكرة في P0: Transactional Outbox

المشكلة: عايز تحفظ "الماتش خلص" في الداتابيز، وتبلغ باقي النظام. لو حفظت وبعدين السيرفر وقع قبل ما تبلغ، النظام يبقى مش متسق.

الحل: تكتب الحدث في جدول `outbox_events` **في نفس الـ transaction** بتاعة التغيير. يا الاتنين يتحفظوا، يا ولا واحد. بعدها الـ Worker بيقرا الجدول ويوزع الأحداث.

ممكن الحدث يتبعت مرتين، عشان كده أي handler لازم يكون **idempotent**، يعني تنفيذه مرتين زي مرة. اقرا [transactional-outbox](backend/transactional-outbox.md) و [idempotency](backend/idempotency.md).

## 6. P1: الحسابات والدخول

قرارك: شيلنا الدخول بالموبايل والـ OTP عشان الـ SMS بفلوس (ADR-0012). الموجود دلوقتي جوجل، و Facebook و X في P11. ولازم نقرر موضوع Sign in with Apple قبل نزول iOS (DEC-48).

### الدخول بيحصل إزاي

<div dir="rtl">

1. التطبيق بيسجل دخول مع جوجل وياخد **ID token**.
2. بيبعته لـ `POST /v1/auth/google`.
3. السيرفر بيتأكد من توقيع جوجل، والـ issuer، وإن التوكن معمول لتطبيقنا، وإنه ما انتهاش. اقرا [oidc-id-token-verification](security/oidc-id-token-verification.md).
4. لو أول مرة، بيعمل مستخدم. لو 5 طلبات جم في نفس اللحظة، بيتعمل مستخدم واحد.
5. بيرجع **access token** و **refresh token**.

</div>

### نوعين توكن، ليه؟

| | Access token | Refresh token |
|---|---|---|
| الشكل | JWT موقع بـ ES256 | نص عشوائي 256 bit |
| العمر | 15 دقيقة افتراضيًا | 60 يوم متجددة، بحد أقصى 180 |
| في الداتابيز | مش متخزن | الـ SHA-256 بتاعه بس |
| بيتبعت | مع كل طلب | لما الـ access ينتهي بس |

الـ access سريع لأن التحقق منه من غير داتابيز، بس صعب تلغيه، فعمره قصير. الـ refresh تقدر تلغيه في أي وقت لأنه متسجل عندنا. لو الداتابيز اتسربت، الهاش ما ينفعش يتستخدم كتوكن. اقرا [jwt](security/jwt.md) و [hashing-tokens-at-rest](security/hashing-tokens-at-rest.md).

**Refresh rotation:** كل refresh بياخد توكن جديد. لو توكن قديم رجع تاني، معناها حد سرقه، فبنلغي السلسلة كلها. عشان كده **التطبيق لازم يبعت refresh واحد في المرة**، ولا هيتعامل معاها كسرقة. اقرا [refresh-token-rotation](security/refresh-token-rotation.md).

### الباقي في P1

- **الحماية افتراضية:** أي endpoint محتاج توكن إلا لو عليه `@Public()`. لو نسيت، الغلطة بتقفل مش بتفتح. اقرا [authn-vs-authz](security/authn-vs-authz.md).
- **الأجهزة:** `logout`، قايمة الجلسات، وإلغاء جهاز معين.
- **البروفايل:** `GET` و `PATCH /v1/me`. الشكل بيتفحص عند الدخول، والقواعد في الـ domain، والتكرار بيمسكه الـ unique index. اقرا [validation-at-the-edge](backend/validation-at-the-edge.md).
- **حذف الحساب:** `DELETE /v1/me` بيحتاج دخول حديث وبيبدأ فترة سماح، والدخول تاني بيلغي الحذف. الصف بيفضل موجود. اقرا [soft-delete](database/soft-delete.md).
- **Rate limit:** 20 طلب في الدقيقة لكل IP على `POST /v1/auth/*` باستخدام Redis. لو Redis وقع بنعدي الطلبات عشان الدخول ما يقفش. اقرا [rate-limiting](backend/rate-limiting.md).
- **WebSocket:** الاتصال بيترفض من أول handshake لو التوكن غلط. اقرا [websocket-handshake-auth](backend/websocket-handshake-auth.md).

## 7. P2: الكورة

### P2.1: قراءة الداتا

الجداول: `competitions`, `seasons`, `teams`, `players`, `matches`, `match_squad_players`, `provider_sync_runs`. ملف الـ migration اللي كنت فاتحه ([migration.sql](../apps/backend/prisma/migrations/20261109192705_football/migration.sql)) هو اللي بينشئهم. فيه `CHECK` اسمه `matches_different_teams` بيمنع فريق يلعب مع نفسه، واتكتب بإيدينا لأن Prisma ما بيعرفش يعبر عنه.

- **Keyset pagination:** بدل "اتخطى 1000 صف"، بنقول "هات اللي بعد الصف ده". أسرع وما بيتلخبطش لو اتضافت صفوف. اقرا [keyset-pagination](database/keyset-pagination.md).
- **الأسماء بلغتين:** عمود `names` نوعه JSONB فيه `ar` و `en`، واللغة من `Accept-Language` أو البروفايل. اقرا [translated-names](backend/translated-names.md).
- **`predictable`:** السيرفر هو اللي بيحسب هل الماتش ينفع يتوقع. عمرنا ما بنثق في ساعة التطبيق.

### P2.2: الداتا الوهمية ودورة حياة الماتش

القلب هنا **state machine** في `match-lifecycle.ts`: جدول بيقول كل حالة تقدر تروح لفين.

<div dir="ltr">

```text
SCHEDULED -> LIVE -> FINISHED
    |         |
    |         +----> ABANDONED -> SCHEDULED
    +-> POSTPONED -> SCHEDULED
    +-> CANCELLED
```

</div>

ماتش `FINISHED` عمره ما يرجع `LIVE`. وأي تغيير حالة بيطلع حدث زي `MatchStarted` أو `MatchFinished`. اقرا [state-machines](backend/state-machines.md).

مزود الداتا ممكن يبعت نفس التحديث مرتين، أو يبعت قديم بعد جديد، أو يبعت في نفس اللحظة. بنتعامل مع ده كده:

| المشكلة | الحل |
|---|---|
| تحديث قديم وصل متأخر | لو مش أحدث من اللي عندنا بيتجاهل (`STALE`). اقرا [out-of-order-updates](backend/out-of-order-updates.md) |
| تحديثين في نفس اللحظة | `FOR UPDATE` بيقفل الصف، والتاني يستنى. اقرا [optimistic-vs-pessimistic-locking](database/optimistic-vs-pessimistic-locking.md) |
| أول إدخال متكرر | `ON CONFLICT DO NOTHING` ثم نكمل على الصف اللي كسب |
| نقلة ممنوعة | بتترفض (`REJECTED`) وبتتسجل في اللوج |

الـ Worker بيعمل المزامنة كل ساعة بـ BullMQ، وكل مرة بتتسجل في `provider_sync_runs`. اقرا [scheduled-jobs](backend/scheduled-jobs.md).

### P2.3: المحاكي (في PR #14)

الكلام المهم هنا إن كل أمر بيعدي من **نفس الطريق** بتاع التحديث الحقيقي، ولا بيعمل `UPDATE` مباشر. فبيلتزم بنفس القواعد ويطلع نفس الأحداث. اقرا [cli-entry-points](backend/cli-entry-points.md).

`mock:run-day --speed 60x` بيفصل بين "إيه اللي هيحصل" (دالة صافية بتعمل جدول خطوات) و"إمتى" (loop بيقسم الانتظار على السرعة). اقرا [simulating-time](backend/simulating-time.md).

## 8. داتا الأسئلة: من Wikidata لحد الماتش

الطريق كله في سطر:

<div dir="ltr">

```text
Wikidata ──(1) ingest──► football_kb ──(2) bundle──► dev-0002 files ──(3) import──► app DB ──(4)──► battle + mobile
             Python         (Python's DB)     Python                     NestJS      (questions, answer_entities)
```

</div>

### 8.1 الداتا منين؟

من **Wikidata**: موسوعة زي ويكيبيديا، بس بدل المقالات فيها حقايق مترتبة، زي "رونالدو ← لعب لـ ← سبورتنج، من 2002 لـ 2003".

- **مجانية بالكامل:** رخصتها CC0، يعني نستخدمها في أي حاجة حتى التجاري.
- **كل حاجة ليها رقم ثابت:** رونالدو `Q11571` وسبورتنج `Q75729`، وبالرقم ده بنربط كل حاجة ببعض.
- **فيها أسامي عربي** لكل أشهر 2000 لاعب.

بنسألها بلغة اسمها **SPARQL**، وهي زي SQL بس للموسوعة. وبنقرا الـ statements الكاملة (`p:/ps:`) مش المختصرة (`wdt:`)، علشان المختصرة بتخبي الأندية القديمة. اقرا [wikidata-truthy-vs-full-statements](database/wikidata-truthy-vs-full-statements.md).

### 8.2 Python بيعمل إيه؟ (`kb ingest`)

الكود في `data/kb/ingest.py`، وبيمشي 6 خطوات:

<div dir="rtl">

1. **الأندية:** كل أندية الـ 9 دوريات اللي في `data/config/scope.toml`، وطلعوا 205 نادي.
2. **اللعيبة:** كل لاعب لعب لأي نادي منهم. لقينا 53,659، وفضل 21,611 ليهم صفحة ويكيبيديا في 8 لغات أو أكتر (`min_player_sitelinks`)، يعني لاعب معروف.
3. **المسيرة:** كل نادي لعب فيه اللاعب، من سنة كام لسنة كام، وهل كانت إعارة.
4. **التنضيف:**
   - بنشيل فرق الشباب والرديف والستات (Barcelona B، Castilla...).
   - بنشيل أي نادي لعب فيه قبل سن 17، وده اللي شال Andorinha من مسيرة رونالدو.
   - بنشيل الدول اللي Wikidata مسجلها غلط كأنها أندية، زي البرازيل.
5. **الجنسيات وسنة الميلاد.**
6. **الأسامي:** الاسم الرسمي والأسامي التانية (`CR7`، "كرستيانو")، وبعدها تصحيحاتنا اليدوية من `data/kb_overrides/names.csv`.

</div>

فيه حاجتين بيخلوه آمن:

- **الكاش:** كل رد من Wikidata بيتخزن في `raw.sparql_cache`. أول مرة بتاخد حوالي 40 دقيقة، وبعد كده حوالي 3 دقايق من غير نت. اقرا [cache-external-responses](database/cache-external-responses.md).
- **transaction واحدة:** الداتا الجديدة بتتكتب كلها مرة واحدة، يا كلها يا ولا حاجة.

النتيجة داتابيز اسمها **`football_kb`**، فيها 21,611 لاعب و 8,090 نادي و 220 دولة و 144 ألف فترة لعب. **دي بتاعة Python بس**، والباك إند عمره ما بيتصل بيها (ADR-0005).

### 8.3 بنعمل منها أسئلة إزاي؟ (`kb bundle`)

الكود في `data/kb/generate.py` و `data/kb/bundle.py`. الفكرة **قوالب، مش ذكاء اصطناعي**: بني آدم كتب كل قالب مرة واحدة بالعربي والإنجليزي، والكود بيملاه من الداتا.

| القالب | شكله | بييجي من |
|---|---|---|
| Career | مسيرة اللاعب كلها وإنت تخمن مين | الفترات بالترتيب |
| أول نادي | "في أي نادٍ / بدأ {اللاعب} / مسيرته / مع الفريق الأول؟" | أول فترة |
| انضم سنة كذا | "أي نادٍ / انضم إليه {اللاعب} / قادمًا من {النادي} / عام {السنة}؟" | فترتين ورا بعض |
| الجنسية | "ما الدولة / التي يحمل / {اللاعب} / جنسيتها؟" | الجنسيات |

**ليه قوالب مش LLM؟** القالب معلومته صح 100% لأنها جاية من الداتا مباشرة، أما الـ LLM ممكن يألف معلومة. Ollama ممكن ييجي بعدين يعيد صياغة الكلام بس، مش المعلومة.

قبل ما أي جولة تطلع، الكود بيرفضها في الحالات دي:

- مسيرة فيها فترة من غير سنة، أو فترتين "لسه بيلعب" مع بعض: المسيرة هتبقى غلط.
- اسم الإجابة مكتوب في السؤال.
- نادي أو دولة مش موجودين في الكتالوج، أو من النوع الغلط.

الصعوبة جاية من شهرة اللاعب: رونالدو (215 لغة) صعوبة 1، واللاعب المغمور صعوبة 5.

الداتا اللي عندنا النهارده تطلع حوالي **78 ألف جولة** (8,907 Career و 69 ألف Buzzer). `dev-0002` عينة منهم: 120 جولة للتطوير.

### 8.4 التلات ملفات

<div dir="rtl">

- **`catalog.jsonl` (القاموس):** كل لاعب ونادي ودولة بأساميهم، وأسامي البحث المتنضفة (`search`). الموبايل بيدور فيه وإنت بتكتب.
- **`questions.jsonl` (الجولات):** كل سطر جولة، ومفيهاش أسامي خالص، فيها `externalRef` بيشاور على القاموس. الإجابة الصح نفسها id.
- **`manifest.json` (البوليصة):** اسم النسخة، وبصمة (`sha256`) كل ملف، والتصنيفات.

</div>

ليه `jsonl`؟ كل سطر حاجة مستقلة، فالغلطة بتطلع برقم السطر، والملف يتقري سطر سطر، والـ git diff بيبقى سطر واحد لو جولة واحدة اتغيرت.

### 8.5 الباك إند بيعمل إيه بالملفات؟

<div dir="rtl">

1. **`questions:import`:** بيتأكد من البصمات، ويستورد الكتالوج الأول، وبعدين الجولات. **بيفحص كل حاجة تاني** ومش بيثق في Python: كل id موجود؟ من النوع الصح؟ أي غلطة في أي سطر = الـ bundle كله يترفض برقم السطر. ده اللي مسك غلطة البرازيل. اقرا [real-data-smoke-run](testing/real-data-smoke-run.md).
2. **`questions:publish`:** الجولات اللي اتراجعت بس بتبقى متاحة للماتشات. في التطوير، `--include-drafts` بينشر الكل، والإنتاج بيرفضه.
3. **في الماتش:** `ContentSelector` بيختار جولات عشوائية، و `AnswerChecker` بيصحح بالـ id مش بالنص. يعني لو كتبت "ارنتجين" غلط، الموبايل بيقترحلك "الأرجنتين" وإنت بتختارها، والسيرفر بيقارن الـ id.
4. **الموبايل:** بينزل القاموس مرة واحدة من `GET /v1/answer-catalog`، وبعدها السيرفر بيرد بـ `304` لو ما اتغيرش. اقرا [http-caching-etag](backend/http-caching-etag.md).

</div>

### 8.6 في الإنتاج

**الأسئلة هتبقى فين؟** في داتابيز التطبيق، في جداول `questions` و `question_answers` و `answer_entities`. السيرفر وهو شغال مش محتاج Python ولا Wikidata ولا نت.

**مين بيشغل Python؟** جهازك، مش السيرفر:

<div dir="rtl">

1. على جهازك: `kb ingest` يجيب الداتا الجديدة، مثلًا بعد كل فترة انتقالات.
2. على جهازك: `kb bundle` يطلع الملفات **بالكتالوج كامل** (22 ألف، مش 3,800).
3. حد يراجع عينة من كل قالب، خصوصًا العربي. الجولات اللي اتراجعت بتبقى `APPROVED`.
4. على السيرفر: `questions:import` وبعدها `questions:publish`.

</div>

ليه كده؟ الميزانية صفر (مفيش سيرفر زيادة)، ولو Wikidata وقعت اللعبة شغالة عادي، ولو bundle طلع فيه مشكلة بنعمل disable للأسئلة دي.

لسه ما اتقررش (قبل الإطلاق): الملفات توصل للسيرفر إزاي (رأيي GitHub Release، علشان الكتالوج الكامل 6 ميجا)، ومين بيراجع وقد إيه، ومسيرة اللاعب اللي لسه بيلعب بتقدم إمتى (DEC-62).

### 8.7 ممكن حد يسرق الأسئلة من الـ APK؟

**لأ، علشان الأسئلة مش في الـ APK أصلًا.** الـ APK فيه كود بس. الجولات والإجابات فاضلين على السيرفر.

- **القاموس بييجي للموبايل:** بس هو أسامي بس، من غير أي سؤال ولا إجابة، وهو أصلًا داتا عامة من Wikidata. لو حد أخده مش هيعرف منه حاجة.
- **أثناء الماتش:** السيرفر هيبعت خطوات السؤال **واحدة واحدة** وهي بتظهر، والخطوات اللي لسه ما ظهرتش مش هتوصل للموبايل. والإجابة الصح مش هتتبعت غير لما الجولة تخلص. فحتى لو حد بيتصنت على الشبكة، هيشوف نفس اللي على الشاشة. ده قاعدة في التصميم (`docs/architecture/08-battle-games.md` §7)، والـ engine اللي هينفذها جاي في P6.1.
- **التصحيح على السيرفر:** الموبايل بيبعت "اخترت id كذا" بس، والسيرفر هو اللي بيقرر صح ولا غلط. فلو حد عدّل الـ APK علشان يقول "أنا جاوبت صح"، ده مش هيفرق.

**الحاجة اللي ممكن تحصل فعلًا:** حد يلعب ماتشات كتير ويسجل كل سؤال وإجابته اللي بتظهر في الآخر، ويعمل منهم "ملف غش". والحماية:

- بنك أسئلة كبير (78 ألف ممكنة).
- السيرفر ما بيكررش عليك أسئلة شفتها قريب (DEC-44).
- وقت الإجابة قصير، ومع الجرس مش هتلحق تدور.

ده خطر مقبول، وكل لعبة أسئلة أونلاين عندها نفس المشكلة.

## 9. رحلتين تلخصوا كل حاجة

### طلب من التطبيق: `GET /v1/matches`

<div dir="rtl">

1. **Guard:** `JwtAuthGuard` بيتأكد من الـ access token.
2. **Interceptor:** بيحدد اللغة.
3. **Pipe:** بيتأكد من شكل الـ query.
4. **Controller:** بينادي `FootballQuery`.
5. **Repository:** بيجيب الصفوف بالـ keyset.
6. **Response:** الأسماء بلغة المستخدم و `predictable` محسوبة.
7. لو حصل error: الفلتر الواحد بيحوله لرد موحد.

</div>

الترتيب ده موجود في [request-pipeline](backend/request-pipeline.md).

### ماتش بيخلص: `mock:finish`

<div dir="rtl">

1. `MatchSimulator` بيبني التحديث.
2. `ApplyProviderMatchUpdate` بيفتح transaction ويقفل صف الماتش.
3. `planMatchUpdate` يقرر: النقلة مسموحة؟ إيه الأحداث؟
4. في نفس الـ transaction: بيحدث `matches` ويكتب `MatchFinished` في `outbox_events`.
5. الـ Worker بينشر الحدث للي مشترك فيه.
6. **لسه مفيش مشتركين.** في P3 التوقعات هتسمع `MatchFinished` وتحسب النقط.

</div>

## 10. مشاكل قابلتنا واتعلمنا منها

| حصل إيه | السبب | الدرس |
|---|---|---|
| إلغاء جلسة فات جلسة جديدة بتتعمل | كل statement ليه snapshot في `READ COMMITTED` | اقفل الصفوف الأول، وبعدين حدث. اقرا [read-committed](database/read-committed.md) |
| تيست المزامنة وقع على الـ CI بس | تيست تاني سجل نفس الـ scheduler في Redis | التيستات ما تعتمدش على ترتيبها |
| تيست المحاكي كسر تيست المزامنة | الاتنين استخدموا نفس اسم الـ provider | كل تيست ليه داتا معزولة |
| تيست الـ rate limit عدى غلط | Redis لسه ما جهزش فالطلب عدى | لازم تستنى الجاهزية في التيست |
| 500 في تيست المحاكي | `TransactionHost` نسخة واحدة لكل process، وكان فيه تطبيقين في نفس الـ process | المشكلة كانت في التيست، والإنتاج فيه تطبيق واحد لكل process |

## 11. مرجع سريع

### الـ endpoints الشغالة

| | |
|---|---|
| الدخول | `POST /v1/auth/google`, `POST /v1/auth/refresh`, `POST /v1/auth/logout` |
| الأجهزة | `GET /v1/auth/sessions`, `DELETE /v1/auth/sessions/{id}` |
| الحساب | `GET`, `PATCH`, `DELETE /v1/me` |
| الكورة | `GET /v1/competitions`, `/v1/matches`, `/v1/matches/{id}`, `/v1/matches/{id}/squads` |
| التوقعات | `PUT`, `GET /v1/matches/{id}/prediction` |
| الأسئلة | `GET /v1/answer-catalog` |
| للتشغيل | `/health/live`, `/health/ready`, `/metrics` |
| للتطوير بس | `/docs`, `/admin/queues`, `POST /v1/_dev/auth/sign-in` |

### الجداول وصاحب كل واحد

| الموديول | الجداول |
|---|---|
| `users` | `users`, `user_profiles`, `user_privacy_settings` |
| `auth` | `auth_identities`, `sessions` |
| `football` | `competitions`, `seasons`, `teams`, `players`, `matches`, `match_squad_players`, `provider_sync_runs` |
| `predictions` | `predictions` |
| `question-bank` | `questions`, `question_answers`, `answer_entities`, `answer_entity_aliases`, `question_import_batches`, ... |
| `shared` | `outbox_events` |

كل جدول ليه موديول واحد بس يكتب فيه.

### أنواع الاختبارات

| النوع | بيختبر إيه | بيشتغل على | العدد |
|---|---|---|---|
| Unit | قواعد الـ domain | من غير داتابيز | 267 |
| Integration | الـ SQL والـ locks والسباقات | Postgres و Redis حقيقيين | 108 |
| E2E | رحلة كاملة | التطبيق كله | 79 |

اقرا [testing-levels](testing/testing-levels.md).

## 12. إيه اللي جاي

الجاي على طول: **P6.1** الـ engine بتاع المعارك مع Buzzer و bot، وبعده **D.2b** مولدات Grid و Who is the player?. وبعدها: **P6** باقي المعارك، **P7** الصحاب، **P8** الغرف، **P9** رجل المباراة، **P10** الدوريات الخاصة، **P11** Facebook و X، **P12** تجهيز الإنتاج. تطبيق الموبايل له مراحل خاصة في `docs/ROADMAP.md`.

قرارات مستنياك:

| القرار | السؤال | الوضع الحالي |
|---|---|---|
| DEC-49 | اسم المستخدم يقبل حروف عربي؟ | إنجليزي وأرقام و `_` |
| DEC-48 | Sign in with Apple | لازم قبل iOS |
| DEC-38 | أقصى عدد في الغرفة، ومين يبدأ | في الإعدادات لحد التجربة |
| Dependabot #5 | ترقية TypeScript 7 | الـ CI واقع، ونصيحتي ما يتدمجش |

## 13. جرب بنفسك

الأوامر دي من جوه `apps/backend`، والأوامر دي من جوه `apps/backend`:

<div dir="ltr">

```bash
docker compose up -d postgres redis
npm run start:worker:dev
npm run start:api:dev
npm run cli -- --help
npm run cli -- mock:run-day --speed 6000x
npm run cli -- questions:import ../../data/bundles/dev-0003
npm run cli -- questions:publish dev-0003 --include-drafts
```

</div>

أمر الـ `docker compose` من جذر المشروع، وكل واحد من الـ worker والـ API في تيرمينال لوحده. وبعدها افتح `http://localhost:3000/docs`.

## 14. تذاكر بالترتيب ده

<div dir="rtl">

1. [modular-monolith](architecture/modular-monolith.md) و [layers-and-ports](architecture/layers-and-ports.md)
2. [transactions-acid](database/transactions-acid.md) و [transactional-outbox](backend/transactional-outbox.md)
3. [jwt](security/jwt.md) و [refresh-token-rotation](security/refresh-token-rotation.md)
4. [row-locking-and-races](database/row-locking-and-races.md) و [read-committed](database/read-committed.md)
5. [state-machines](backend/state-machines.md) وبعدها افتح `match-lifecycle.ts` واقراه

</div>

</div>
