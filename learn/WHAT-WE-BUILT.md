<div dir="rtl">

# إحنا عملنا إيه لحد دلوقتي

آخر تحديث: 2026-11-10. وقت القراية: حوالي 20 دقيقة. كل مصطلح مهم ليه كارت قصير في `learn/`، والروابط موجودة جوه الكلام.

## 1. الخلاصة

بنبني **لعبة اجتماعية عن كورة القدم**: توقعات ماتشات، تصويت رجل المباراة، ومعارك أسئلة أونلاين. الكور بتاع اللعبة هو المعارك.

اللي خلص لحد دلوقتي هو **الأساس اللي اللعبة هتتبني فوقه**، مش اللعبة نفسها:

- سيرفر شغال بقاعدة بيانات و Redis وعمليات في الخلفية.
- تسجيل دخول بجوجل، وإدارة الأجهزة والحساب.
- داتا كورة وهمية كاملة: بطولات وفرق ولعيبة وماتشات، بالعربي والإنجليزي.
- أداة تتحكم بيها في أي ماتش من التيرمينال، وتلعب يوم ماتشات كامل في ثواني.

لسه ما اتبناش: التوقعات، النقط، الترتيب، الأسئلة، المعارك، الغرف، الصحاب، الدوريات الخاصة، وتطبيق الموبايل.

## 2. الحالة دلوقتي

| الجزء | فيه إيه | الحالة |
|---|---|---|
| التوثيق والقرارات | PRD، المعمارية، الـ API، الـ ADRs | في `main` |
| **P0** الأساس | NestJS، Postgres، Redis، Outbox، CI | في `main` |
| **P1** الحسابات | جوجل، الجلسات، البروفايل، حذف الحساب | في `main` |
| **P2.1** قراءة الكورة | البطولات والماتشات بالعربي والإنجليزي | في `main` |
| **P2.2** داتا وهمية ودورة حياة الماتش | Mock provider، state machine، مزامنة كل ساعة | في `main` |
| الغرف متعددة اللاعبين | قرار مكتوب في DEC-38، والكود في P8 | في `main` |
| **P2.3** المحاكي | أوامر `mock:*` | [PR #14](https://github.com/the-game22027/the-game/pull/14) مفتوح ومستني `merge` |

الأرقام: 161 unit test و 53 integration test و 61 e2e test، و 37 كارت تعلم.

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

## 8. رحلتين تلخصوا كل حاجة

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

## 9. مشاكل قابلتنا واتعلمنا منها

| حصل إيه | السبب | الدرس |
|---|---|---|
| إلغاء جلسة فات جلسة جديدة بتتعمل | كل statement ليه snapshot في `READ COMMITTED` | اقفل الصفوف الأول، وبعدين حدث. اقرا [read-committed](database/read-committed.md) |
| تيست المزامنة وقع على الـ CI بس | تيست تاني سجل نفس الـ scheduler في Redis | التيستات ما تعتمدش على ترتيبها |
| تيست المحاكي كسر تيست المزامنة | الاتنين استخدموا نفس اسم الـ provider | كل تيست ليه داتا معزولة |
| تيست الـ rate limit عدى غلط | Redis لسه ما جهزش فالطلب عدى | لازم تستنى الجاهزية في التيست |
| 500 في تيست المحاكي | `TransactionHost` نسخة واحدة لكل process، وكان فيه تطبيقين في نفس الـ process | المشكلة كانت في التيست، والإنتاج فيه تطبيق واحد لكل process |

## 10. مرجع سريع

### الـ endpoints الشغالة

| | |
|---|---|
| الدخول | `POST /v1/auth/google`, `POST /v1/auth/refresh`, `POST /v1/auth/logout` |
| الأجهزة | `GET /v1/auth/sessions`, `DELETE /v1/auth/sessions/{id}` |
| الحساب | `GET`, `PATCH`, `DELETE /v1/me` |
| الكورة | `GET /v1/competitions`, `/v1/matches`, `/v1/matches/{id}`, `/v1/matches/{id}/squads` |
| للتشغيل | `/health/live`, `/health/ready`, `/metrics` |
| للتطوير بس | `/docs`, `/admin/queues`, `POST /v1/_dev/auth/sign-in` |

### الجداول وصاحب كل واحد

| الموديول | الجداول |
|---|---|
| `users` | `users`, `user_profiles`, `user_privacy_settings` |
| `auth` | `auth_identities`, `sessions` |
| `football` | `competitions`, `seasons`, `teams`, `players`, `matches`, `match_squad_players`, `provider_sync_runs` |
| `shared` | `outbox_events` |

كل جدول ليه موديول واحد بس يكتب فيه.

### أنواع الاختبارات

| النوع | بيختبر إيه | بيشتغل على | العدد |
|---|---|---|---|
| Unit | قواعد الـ domain | من غير داتابيز | 161 |
| Integration | الـ SQL والـ locks والسباقات | Postgres و Redis حقيقيين | 53 |
| E2E | رحلة كاملة | التطبيق كله | 61 |

اقرا [testing-levels](testing/testing-levels.md).

## 11. إيه اللي جاي

الترتيب: **P3** التوقعات والنقط، **P4** الترتيب، **P5** بنك الأسئلة، **P6** المعارك، **P7** الصحاب، **P8** الغرف، **P9** رجل المباراة، **P10** الدوريات الخاصة، **P11** Facebook و X، **P12** تجهيز الإنتاج. تطبيق الموبايل له مراحل خاصة في `docs/ROADMAP.md`.

قرارات مستنياك:

| القرار | السؤال | الوضع الحالي |
|---|---|---|
| DEC-49 | اسم المستخدم يقبل حروف عربي؟ | إنجليزي وأرقام و `_` |
| DEC-48 | Sign in with Apple | لازم قبل iOS |
| DEC-38 | أقصى عدد في الغرفة، ومين يبدأ | في الإعدادات لحد التجربة |
| Dependabot #5 | ترقية TypeScript 7 | الـ CI واقع، ونصيحتي ما يتدمجش |

## 12. جرب بنفسك

الأوامر دي من جوه `apps/backend`، والمحاكي محتاج تكون على فرع `feat/p2-simulator-cli` لحد ما PR #14 يتدمج:

<div dir="ltr">

```bash
docker compose up -d postgres redis
npm run start:worker:dev
npm run start:api:dev
npm run cli -- --help
npm run cli -- mock:run-day --speed 6000x
```

</div>

أمر الـ `docker compose` من جذر المشروع، وكل واحد من الـ worker والـ API في تيرمينال لوحده. وبعدها افتح `http://localhost:3000/docs`.

## 13. تذاكر بالترتيب ده

<div dir="rtl">

1. [modular-monolith](architecture/modular-monolith.md) و [layers-and-ports](architecture/layers-and-ports.md)
2. [transactions-acid](database/transactions-acid.md) و [transactional-outbox](backend/transactional-outbox.md)
3. [jwt](security/jwt.md) و [refresh-token-rotation](security/refresh-token-rotation.md)
4. [row-locking-and-races](database/row-locking-and-races.md) و [read-committed](database/read-committed.md)
5. [state-machines](backend/state-machines.md) وبعدها افتح `match-lifecycle.ts` واقراه

</div>

</div>
