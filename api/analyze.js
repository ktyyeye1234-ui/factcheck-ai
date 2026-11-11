// Vercel 서버리스 함수: Gemini API 키는 서버 환경변수에만 있고 브라우저에는 전달되지 않습니다.
const hits = new Map();
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const AGENCIES = ['stat', 'kdca', 'moe', 'korea', 'snu', 'kpf'];

const prompt = (text) => `당신은 신중한 한국어 팩트체커입니다. 오늘은 ${new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}입니다.
아래 [뉴스 내용]을 분석하세요. Google 검색으로 핵심 주장을 실제로 확인하세요.
원칙:
- 입력 내용을 무조건 사실로 받아들이지 말고, 주장과 의견을 구분하세요.
- 어조나 표현만으로 허위라고 판정하지 마세요.
- 검색 결과의 작성 기관과 날짜를 확인하고, 출처끼리 내용이 충돌하면 conflicts에 적으세요.
- 검색으로 확인하지 못했거나 근거가 부족하면 verdict는 반드시 "insufficient"로 하세요.
- 출처 URL, 기사·논문 제목을 지어내지 마세요. 쉬운 한국어로 쓰세요.
JSON만 출력하세요(코드블록 금지):
{"verdict":"reliable|check|false|insufficient","summary":"한두 문장 결론","claims":[{"text":"핵심 주장","type":"fact|opinion","needs_check":true}],"exaggerations":["과장·자극 표현"],"entities":[{"kind":"날짜|수치|인물|기관","text":"내용","note":"확인 결과"}],"confirmed":["검색으로 확인된 사실"],"suspicious":["의심되는 부분"],"conflicts":["출처 간 충돌 내용"],"to_check":["추가로 확인할 내용"],"reason":"판단 이유","agencies":["stat|kdca|moe|korea|snu|kpf 중 관련 있는 것만"]}
[뉴스 내용]
${text}`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST 요청만 지원해요.' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: '서버에 GEMINI_API_KEY가 설정되지 않았어요.' });

  // 간단한 요청 제한(IP당 1분 6회, 서버 인스턴스 단위의 최선 노력 방식)
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= 6) return res.status(429).json({ error: '요청이 너무 많아요. 1분 뒤 다시 시도해 주세요.' });
  recent.push(now);
  hits.set(ip, recent);

  const text = String((req.body && req.body.text) || '').trim().slice(0, 8000);
  if (text.length < 15) return res.status(400).json({ error: '분석할 내용을 15자 이상 입력해 주세요.' });

  try {
    const g = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt(text) }] }],
        tools: [{ google_search: {} }],
      }),
    });
    const data = await g.json().catch(() => ({}));
    if (!g.ok) {
      console.error('Gemini error', g.status, data && data.error && data.error.message);
      return res.status(g.status === 429 ? 429 : 502).json({ error: g.status === 429 ? 'AI 사용량 한도에 도달했어요. 잠시 후 다시 시도해 주세요.' : 'AI 서버 오류가 발생했어요. 다시 시도해 주세요.' });
    }
    const cand = (data.candidates || [])[0] || {};
    const out = ((cand.content && cand.content.parts) || []).map((p) => p.text || '').join('');
    const a = out.indexOf('{'), b = out.lastIndexOf('}');
    if (a < 0 || b < a) return res.status(502).json({ error: 'AI 응답을 해석하지 못했어요. 다시 시도해 주세요.' });
    const r = JSON.parse(out.slice(a, b + 1));

    // 실제 검색에서 나온 출처만 전달 (중복 제거)
    const seen = new Set();
    const sources = (((cand.groundingMetadata || {}).groundingChunks) || [])
      .map((c) => c.web).filter((w) => w && /^https?:\/\//.test(w.uri || '') && !seen.has(w.uri) && seen.add(w.uri))
      .map((w) => ({ title: w.title || '', uri: w.uri }));

    r.agencies = (r.agencies || []).filter((k) => AGENCIES.includes(k));
    // 검색 근거가 없으면 '신뢰할 만함'으로 판정하지 않음
    if (!sources.length && r.verdict === 'reliable') {
      r.verdict = 'check';
      r.to_check = [...(r.to_check || []), '검색으로 확인된 자료가 없어 공식 자료를 직접 확인해 주세요.'];
    }
    return res.status(200).json({ r, sources });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: '분석 중 서버 오류가 발생했어요.' });
  }
};
