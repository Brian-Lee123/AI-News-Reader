// /api/summarize.ts
import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Vercel 환경 변수에서 API 키를 안전하게 가져옵니다.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { title, content, summaryLength } = req.body;

  if (!title || !content || !summaryLength) {
    return res.status(400).json({ error: 'Missing required body parameters: title, content, summaryLength' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const lengthPromptMap = {
      'short': '두세 문장으로 짧게',
      'medium': '핵심 내용을 중심으로 세 문단으로',
      'long': '주요 내용을 상세하게 여러 문단으로'
    };
    const lengthInstruction = lengthPromptMap[summaryLength as keyof typeof lengthPromptMap] || '핵심 내용을 중심으로';

    const prompt = `다음 IT/AI 관련 뉴스 기사를 한국어로 ${lengthInstruction} 요약해줘. 응답은 마크다운 형식으로 작성해줘. 요약의 제목은 '##'으로 시작하게 하고, 중요한 키워드나 이름은 **굵게** 표시해줘.\n\n제목: ${title}\n\n내용:\n${content.substring(0, 4000)}`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.status(200).json({ summary: response.text });

  } catch (error: any) {
    console.error('Error generating summary:', error);
    res.status(500).json({ error: 'Failed to generate summary.', details: error.message });
  }
}
