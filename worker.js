// Deployment smoke-test marker: changing this watched file should trigger a GitHub build.
const SYSTEM_INSTRUCTION = `あなたはTASK AI。仕事の詰まりを解消する意思決定支援者です。ユーザーと会話し、会話履歴全体を踏まえて分析してください。
不足情報があり、その答えで次の一手が実質的に変わる場合だけ、type="question"を返してください。質問は1回につき必ず1つです。質問だけを返し、選択肢は任意で最大4つ。複数質問を一つにまとめないでください。必要な情報が揃ったらtype="analysis"で返してください。
分析は必ず以下の5項目を含め、具体的で実行可能にしてください: blockage (詰まりの構造), dependencies (依存している事項), missing (不足している情報・判断), next_action (次の一手。小さく具体的な行動), why_now (なぜ今それをやるか)。
確定した事実と推測を区別し、情報がない場合は不明と明記します。ユーザーの仕事を勝手に実行するのではなく判断を支援してください。
次のJSON形式のみを返してください:
質問: {"type":"question","question":"一つの質問","choices":["任意の選択肢"]}
分析: {"type":"analysis","blockage":"...","dependencies":"...","missing":"...","next_action":"...","why_now":"..."}`;
const corsHeaders = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
});
function json(data, status, origin) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json; charset=utf-8" } });
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (!env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return new Response("Forbidden", { status: 403 });
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);
    if (!env.GEMINI_API_KEY) return json({ error: "サーバーにGemini APIキーが設定されていません" }, 503, origin);
    try {
      const length = Number(request.headers.get("Content-Length") || 0);
      if (length > 30000) return json({ error: "会話が長すぎます。新しい相談を始めてください" }, 413, origin);
      const body = await request.json();
      if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 20) {
        return json({ error: "会話形式が正しくありません" }, 400, origin);
      }
      const messages = body.messages.map(m => {
        if (!["user", "model"].includes(m.role) || typeof m.text !== "string" || m.text.length > 5000) throw new Error("会話形式が正しくありません");
        return { role: m.role, parts: [{ text: m.text }] };
      });
      if (messages[messages.length - 1].role !== "user") return json({ error: "最新の発言が見つかりません" }, 400, origin);
      const model = env.GEMINI_MODEL || "gemini-2.5-flash";
      const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: messages,
          generationConfig: { responseMimeType: "application/json", temperature: 0.3, maxOutputTokens: 1200 }
        })
      });
      if (!upstream.ok) {
        const error = await upstream.json().catch(() => ({}));
        console.error("Gemini request failed", upstream.status, error.error?.status || "");
        return json({ error: "Gemini APIへの接続に失敗しました。サーバー設定を確認してください" }, 502, origin);
      }
      const generated = await upstream.json();
      const text = generated.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("");
      if (!text) return json({ error: "Geminiから有効な応答がありませんでした" }, 502, origin);
      let result;
      try { result = JSON.parse(text); } catch { return json({ error: "Geminiの応答を読み取れませんでした。もう一度お試しください" }, 502, origin); }
      if (result.type === "question") {
        if (typeof result.question !== "string" || !result.question.trim()) return json({ error: "Geminiの質問形式が正しくありません" }, 502, origin);
        result = { type: "question", question: result.question.slice(0, 1000), choices: Array.isArray(result.choices) ? result.choices.filter(x => typeof x === "string").slice(0, 4).map(x => x.slice(0, 120)) : [] };
      } else if (result.type === "analysis" && ["blockage", "dependencies", "missing", "next_action", "why_now"].every(k => typeof result[k] === "string")) {
        result = Object.fromEntries(["type", "blockage", "dependencies", "missing", "next_action", "why_now"].map(k => [k, result[k].slice(0, 2500)]));
      } else return json({ error: "Geminiの応答形式が正しくありません" }, 502, origin);
      return json({ result }, 200, origin);
    } catch (error) {
      console.error("Request processing failed", error.message);
      return json({ error: "リクエストを処理できませんでした" }, 400, origin);
    }
  }
};
