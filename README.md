# FACT CHECK AI (Gemini 서버 연결 버전)

브라우저 → `/api/analyze`(서버) → Gemini API(Google 검색 연동). API 키는 서버 환경변수에만 저장됩니다.

## 배포 (Vercel, 무료 플랜으로 시작 가능)
1. https://aistudio.google.com/apikey 에서 Gemini API 키를 발급받습니다.
2. 이 폴더를 GitHub 저장소로 올립니다.
3. https://vercel.com 에서 **Add New → Project**로 그 저장소를 가져옵니다.
4. **Environment Variables**에 `GEMINI_API_KEY` = 발급받은 키를 추가합니다. (선택: `GEMINI_MODEL`, 기본값 gemini-2.5-flash)
5. **Deploy**를 누르면 `https://○○○.vercel.app` 주소가 생깁니다. 이 주소를 공유하세요.

CLI로 할 경우: `npm i -g vercel` → 이 폴더에서 `vercel` → `vercel env add GEMINI_API_KEY` → `vercel --prod`
로컬 시험: `.env.local`에 `GEMINI_API_KEY=키` 저장 후 `vercel dev`

## 주의
- API 키를 index.html이나 GitHub에 직접 적지 마세요.
- 누구나 쓸 수 있으므로 사용량 한도와 요금은 Google AI Studio/Cloud 콘솔에서 확인하세요. 서버에 IP당 1분 6회 제한이 있지만 간단한 방식이에요.
- 모델 이름이 바뀌면 `GEMINI_MODEL` 환경변수만 수정하면 됩니다.
