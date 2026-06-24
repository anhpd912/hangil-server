# Ôn tập v2: Flashcard + 3 game mode (AI sinh câu hỏi)

## Bối cảnh
"Ôn tập" hiện chỉ có Flashcard SRS (`/flashcard`). Theo yêu cầu: thêm nhánh "Trò chơi ôn tập" với 3 mode — Nối từ (Matching), Điền từ (Context-Fill), Trắc nghiệm (Speed Quiz) — Context-Fill và Speed-Quiz do AI sinh câu hỏi (10 câu/lần) từ từ vựng **đã học** (user_cards), trả lời sai = cập nhật SRS grade 0 (Lại) cho từ đó.

## IA mới
```
Sidebar "Ôn tập" → /review (hub: Flashcard | Trò chơi ôn tập)
  /flashcard           — giữ nguyên, không đổi
  /games                — hub 3 card: Nối từ | Điền từ | Trắc nghiệm
    /games/matching
    /games/context-fill
    /games/speed-quiz
```

## Quyết định đã khoá
- Nguồn từ: `user_cards` của user (từ đã học) — không dùng toàn bộ `vocabulary`. Cần ≥10 từ đã học mới chơi được game (empty-state nếu thiếu).
- Sai câu hỏi → gọi `calculateNextReview(card, 0)` cập nhật `user_cards` của từ đó (giống flashcard review). Đúng → không đổi SRS (tránh double-count với flashcard thật).
- Matching mode: **không cần AI** — chỉ là xáo cặp Hàn↔Việt từ 10 từ đã học, tất toán, nhanh, không tốn token. Chỉ Context-Fill và Speed-Quiz gọi AI.
- Điểm/streak/accuracy là ephemeral theo session (giống `SessionComplete` của flashcard), không cần bảng lưu lịch sử riêng (YAGNI).

---

## Phase 1 — Backend (hangil-server)

### 1A. Word selection helper
`src/services/games/select-words.ts`:
```ts
export async function selectLearnedWords(userId: string, count = 10) {
  // join user_cards + vocabulary, order by easiness asc (ưu tiên từ yếu nhất), limit count
}
```
Trả `{ cardId, vocabId, korean, romanization, vietnamese }[]`. Nếu `< 10` kết quả → route trả lỗi `NOT_ENOUGH_WORDS` (FE hiện empty-state).

### 1B. AI system prompts
`src/services/ai/index.ts` — thêm 2 hàm theo đúng pattern `checkJournal` hiện có (gọi `getProvider().complete()`, parse JSON, validate qua zod trước khi trả):

**`generateContextFillQuestions(words)`** — system prompt:
```
Bạn là giáo viên tiếng Hàn cho người Việt. Với danh sách từ vựng cho sẵn, tạo
CHÍNH XÁC {count} câu hỏi điền từ. Mỗi câu hỏi dùng 1 từ trong danh sách,
đặt trong 1 câu tiếng Hàn tự nhiên, đời thường, đúng ngữ pháp, phù hợp người
mới học. Thay từ mục tiêu bằng "[...]". Đưa ra 4 lựa chọn tiếng Hàn (gồm từ
đúng), 3 lựa chọn sai phải là từ/cụm từ THẬT, dễ nhầm về nghĩa hoặc ngữ pháp
(không phải từ vô nghĩa hoặc quá khác biệt). CHỈ dùng từ trong danh sách được
cho — không tự thêm từ mới.

Trả về JSON THUẦN (không markdown, không giải thích), đúng format:
[{"vocabId":"...","sentenceKo":"... [...] ...","translationVi":"...","options":["...","...","...","..."],"correctIndex":0}]
```
**`generateSpeedQuizQuestions(words)`** — system prompt:
```
Bạn là giáo viên tiếng Hàn cho người Việt. Với danh sách từ vựng cho sẵn, tạo
CHÍNH XÁC {count} câu hỏi trắc nghiệm tốc độ: cho 1 từ tiếng Hàn, người học
chọn nghĩa tiếng Việt đúng trong 4 lựa chọn. 3 lựa chọn sai phải là nghĩa
THẬT của từ khác (không bịa), cùng chủ đề/sắc thái để có độ khó vừa phải,
tránh quá dễ đoán bằng loại trừ.

Trả về JSON THUẦN (không markdown, không giải thích), đúng format:
[{"vocabId":"...","korean":"...","options":["...","...","...","..."],"correctIndex":0}]
```
Cả 2: validate response qua zod schema tương ứng (`contextFillQuestionSchema`, `speedQuizQuestionSchema` trong `lib/validators.ts`) — nếu AI trả sai format/length ≠ 10/vocabId không khớp danh sách input → retry 1 lần, thất bại lần 2 → lỗi `AI_GENERATION_FAILED` (502), KHÔNG fallback sang câu hỏi giả.

### 1C. Session/answer-key storage
Dùng `redis` (export sẵn ở `plugins/ratelimit.ts`) — KHÔNG trả `correctIndex`/đáp án đúng cho client lúc generate (tránh lộ đáp án qua devtools). Lưu:
```
key: game:{sessionId}   value: { mode, userId, answerKey: [{vocabId, cardId, correctIndex|correctVocabId}] }
TTL: 30 phút
```
`sessionId = crypto.randomUUID()`.

### 1D. Routes — `src/routes/games.ts` (mới, đăng ký trong `index.ts` cùng prefix `/api/v1`)
- `POST /games/matching/generate` (auth) — không AI, lấy 10 từ, trả `{sessionId, pairs:[{vocabId,korean,vietnamese}]}` (đã xáo, không kèm đáp án ghép sẵn — pairs chính là đáp án vì matching cần ghép đúng korean↔vietnamese của CÙNG vocabId, FE tự xáo 2 cột rồi gửi map khi submit).
- `POST /games/context-fill/generate` (auth) — lấy 10 từ → `generateContextFillQuestions` → lưu answer key → trả `{sessionId, questions:[{vocabId,sentenceKo,translationVi,options}]}` (không kèm `correctIndex`).
- `POST /games/speed-quiz/generate` (auth) — tương tự, trả `{sessionId, questions:[{vocabId,korean,options}]}`.
- `POST /games/:mode/submit` (auth) — body `{sessionId, answers:[{vocabId, selectedIndex}]}` (matching: `answers:[{koreanVocabId, vietnameseVocabId}]`). Đọc answer key từ redis (xoá ngay sau khi đọc — single-use), so khớp, với mỗi câu SAI gọi `calculateNextReview(card, 0)` update `user_cards`. Trả `{score, accuracy, results:[{vocabId,correct}]}`.

Validators mới trong `lib/validators.ts`: `gameSubmitBodySchema` theo mode (dùng `z.discriminatedUnion` hoặc 2 schema riêng theo `:mode` param).

### 1E. Rate limit
AI-gen 2 mode dùng `checkRateLimit` — Free: 5 lần/ngày tổng (matching không cần limit vì không tốn AI), Pro: unlimited. Theo đúng convention `ai/journal-check`.

---

## Phase 2 — Frontend (hangil-app)

### 2A. Types + API client
- `shared/api/types/game.ts`: `GameMode = "matching"|"context-fill"|"speed-quiz"`, `MatchingPair`, `ContextFillQuestion`, `SpeedQuizQuestion`, `GameSubmitResult`.
- `shared/api/games-api.ts`: `generate(mode)`, `submit(mode, sessionId, answers)` — theo pattern `cards-api.ts`.

### 2B. Review hub (`/review`)
- `app/review/page.tsx` + `features/review/review-hub-page.tsx` — 2 card lớn: "Flashcard" (→ `/flashcard`) | "Trò chơi ôn tập" (→ `/games`). Style nhất quán DESIGN.md (border 1px, rounded-2xl, không icon/ảnh thật — bỏ ảnh minh hoạ trong ảnh mockup gốc vì hệ thống thiết kế hiện tại không dùng ảnh/icon, chỉ typographic).
- Sidebar: đổi "Ôn tập" `href` từ `/flashcard` → `/review`.

### 2C. Games hub (`/games`)
- `features/games/games-hub-page.tsx` — 3 card: Nối từ / Điền từ / Trắc nghiệm, mỗi card có mô tả ngắn (lấy nguyên ý mockup, bỏ ảnh) + nút "Bắt đầu" → `/games/{mode}`.
- Empty-state: nếu user có `< 10` từ đã học (check qua 1 field nhẹ, ví dụ gọi `progressApi.get().totalCards` đã có sẵn) → hiện thông báo "Học thêm từ vựng để mở khoá trò chơi" thay vì cho bấm vào.

### 2D. Game session pages (`/games/[mode]`)
- `app/games/[mode]/page.tsx` (dynamic, giống `/lessons/[id]`) + `features/games/game-session-page.tsx` — switch theo `mode`, render 1 trong 3 component con:
  - `components/matching-game.tsx` — lưới 2 cột (Hàn | Việt), click chọn 1 bên rồi 1 bên kia để ghép, đúng → khoá cặp + style completed, sai → shake nhẹ + reset chọn.
  - `components/context-fill-game.tsx` — câu có `[...]`, 4 nút lựa chọn (giống ảnh mockup: card đề bài + 4 pill option), tiến trình "08/20" kiểu progress + accuracy + avg time (đơn giản hoá: chỉ progress "x/10" + accuracy live).
  - `components/speed-quiz-game.tsx` — từ Hàn lớn giữa, 4 option, đồng hồ đếm lùi/đếm câu, streak hiện tại (tái dùng style timer đơn giản, KHÔNG cần animation phức tạp).
- Chung 1 hook `hooks/use-game-session.ts`: gọi `generate` lúc mount → giữ `questions`/`pairs`, theo dõi `answers[]`, khi hết câu → gọi `submit` → chuyển sang state `"complete"`.
- `components/game-complete.tsx` — tái dùng layout `SessionComplete` của flashcard (điểm, accuracy, nút Về trang chủ / Chơi lại).

## Việc KHÔNG làm (YAGNI)
- Không bảng lưu lịch sử điểm game riêng — ephemeral per session.
- Không leaderboard/so sánh người dùng khác.
- Không AI cho Matching mode (mechanical, không cần).
- Không grading real-time càng-đúng-càng-điểm-cao kiểu Duolingo combo — giữ tính đúng/sai đơn giản.

## Verification
- BE: `npm run build && npm test` (hangil-server) — viết test cho `selectLearnedWords` (mock db) và format-validate response của 2 hàm AI-gen (mock provider trả JSON hợp lệ/không hợp lệ → assert retry/lỗi đúng).
- FE: `npm run build && npm run lint` (hangil-app).
- Manual: user có ≥10 từ đã học (sau khi hoàn thành ≥1 lesson) → vào `/review` → `/games` → chơi đủ 3 mode → trả lời sai 1 câu Context-Fill → confirm từ đó xuất hiện lại trong `/flashcard` (do/nextReviewAt đã reset).

## Câu hỏi mở
- Limit AI-gen 5 lần/ngày cho Free có đúng không, hay nên tính riêng cho Context-Fill/Speed-Quiz (mỗi mode 5 lần) thay vì tổng?
