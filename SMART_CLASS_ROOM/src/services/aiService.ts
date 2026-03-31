import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const extractJsonObject = (text: string) => {
  const trimmed = (text || '').trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) return JSON.parse(fenced[1]);
    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
    }
    return {};
  }
};

const extractJsonArray = (text: string) => {
  const trimmed = (text || '').trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray((parsed as any).questions)) return (parsed as any).questions;
    return [];
  } catch {
    const fenced = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
    if (fenced?.[1]) {
      try {
        const parsed = JSON.parse(fenced[1]);
        if (Array.isArray(parsed)) return parsed;
        if (Array.isArray((parsed as any).questions)) return (parsed as any).questions;
      } catch {}
    }

    const arrayStart = trimmed.indexOf('[');
    const arrayEnd = trimmed.lastIndexOf(']');
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      try { return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1)); } catch {}
    }
    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
      try {
        const parsed = JSON.parse(trimmed.slice(objectStart, objectEnd + 1));
        if (Array.isArray((parsed as any).questions)) return (parsed as any).questions;
      } catch {}
    }
    return [];
  }
};

const normalizeCorrectAnswer = (value: any) => {
  if (!value) return 'A';
  const v = String(value).trim().toUpperCase();
  if (['A', 'B', 'C', 'D'].includes(v)) return v;
  if (v.startsWith('OPTION A')) return 'A';
  if (v.startsWith('OPTION B')) return 'B';
  if (v.startsWith('OPTION C')) return 'C';
  if (v.startsWith('OPTION D')) return 'D';
  return 'A';
};

const normalizeQuestions = (raw: any[]) => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q: any) => ({
      question_text: String(q?.question_text ?? q?.question ?? '').trim(),
      option_a: String(q?.option_a ?? q?.a ?? q?.options?.A ?? q?.options?.a ?? '').trim(),
      option_b: String(q?.option_b ?? q?.b ?? q?.options?.B ?? q?.options?.b ?? '').trim(),
      option_c: String(q?.option_c ?? q?.c ?? q?.options?.C ?? q?.options?.c ?? '').trim(),
      option_d: String(q?.option_d ?? q?.d ?? q?.options?.D ?? q?.options?.d ?? '').trim(),
      correct_answer: normalizeCorrectAnswer(q?.correct_answer ?? q?.answer),
    }))
    .filter((q: any) => q.question_text && q.option_a && q.option_b && q.option_c && q.option_d);
};

// Helpers to sanitize/normalize resource URLs returned by the AI
const isValidUrl = (u: string | undefined) => {
  if (!u) return false;
  try { new URL(u); return true; } catch { return false; }
};

const withHttps = (u: string | undefined) => {
  if (!u) return '';
  const v = String(u).trim();
  if (!v) return '';
  if (v.startsWith('http://') || v.startsWith('https://')) return v;
  if (v.startsWith('www.')) return `https://${v}`;
  if (v.startsWith('youtube.com') || v.startsWith('m.youtube.com') || v.startsWith('youtu.be')) return `https://${v}`;
  return v;
};

const isYouTubeHost = (host: string) => {
  const h = host.toLowerCase();
  return h.includes('youtube.com') || h.includes('youtu.be');
};

const extractYouTubeVideoId = (urlOrId: string | undefined) => {
  const value = String(urlOrId || '').trim();
  if (!value) return null;
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  const normalized = withHttps(value);
  try {
    const parsed = new URL(normalized);
    if (!isYouTubeHost(parsed.hostname)) return null;

    const searchParams = parsed.searchParams;
    const direct = searchParams.get('v') || searchParams.get('vi') || searchParams.get('video_id');
    if (direct && /^[A-Za-z0-9_-]{11}$/.test(direct)) return direct;

    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const pathCandidates = [pathParts[pathParts.length - 1], pathParts[pathParts.length - 2]].filter(Boolean) as string[];
    for (const candidate of pathCandidates) {
      if (/^[A-Za-z0-9_-]{11}$/.test(candidate)) return candidate;
    }

    // Last chance: regex extraction from full URL text.
    const match = normalized.match(/(?:v=|vi=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/i);
    if (match?.[1]) return match[1];
  } catch {
    const match = normalized.match(/(?:v=|vi=|youtu\.be\/|embed\/|shorts\/|live\/)([A-Za-z0-9_-]{11})/i);
    if (match?.[1]) return match[1];
  }
  return null;
};

const toYouTubeWatchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

const validateYouTubeWatchUrl = async (url: string) => {
  const id = extractYouTubeVideoId(url);
  // Browser-side oEmbed checks can fail due to CORS/network limits.
  // Canonical ID validation is sufficient for playable embed URLs.
  return Boolean(id);
};

const isPlaceholderUrl = (u: string | undefined) => {
  if (!u) return true;
  const v = u.toLowerCase();
  return (
    v.includes('...') ||
    v.includes('example.com') ||
    v.includes('your-link') ||
    v.includes('placeholder')
  );
};

const sanitizeYouTubeUrl = (url: string | undefined, title = '') => {
  const queryBase = String(title || url || '').trim();
  const query = queryBase || 'educational video';
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
};

const sanitizeWebsiteUrl = (url: string | undefined, title = '', subject = '', topic = '') => {
  const normalized = withHttps(url);
  if (isValidUrl(normalized) && !isPlaceholderUrl(normalized)) return normalized as string;
  // If not a valid URL, search the web for the resource title + context
  const query = [title, subject, topic].filter(Boolean).join(' ');
  return `https://www.google.com/search?q=${encodeURIComponent(query || title || url || 'learning+resource')}`;
};

const sanitizeResources = (res: any, subject = '', topic = '') => {
  if (!res) {
    return {
      objective: '',
      resources: { youtube: [], websites: [] },
      studyGuide: '',
      summary: '',
      keywords: []
    };
  }
  const rawYoutube = Array.isArray(res.youtube) ? res.youtube : [];
  const rawWebsites = Array.isArray(res.websites) ? res.websites : [];
  const clean = {
    objective: res.objective || '',
    resources: {
      youtube: Array.isArray(res.resources?.youtube) ? res.resources.youtube : rawYoutube,
      websites: Array.isArray(res.resources?.websites) ? res.resources.websites : rawWebsites,
    },
    studyGuide: res.studyGuide || '',
    summary: res.summary || '',
    keywords: Array.isArray(res.keywords) ? res.keywords : [],
  } as any;
  if (clean.resources) {
    if (Array.isArray(clean.resources.youtube)) {
      clean.resources.youtube = clean.resources.youtube.map((y: any) => ({
        title: y.title || 'Video',
        url: sanitizeYouTubeUrl(y.url, y.title || `${topic} ${subject}`),
      }));
    }
    if (Array.isArray(clean.resources.websites)) {
      clean.resources.websites = clean.resources.websites.map((w: any) => ({
        title: w.title || 'Website',
        url: sanitizeWebsiteUrl(w.url, w.title || '', subject, topic),
      }));
    }
  }
  return clean;
};

const normalizeYouTubeList = async (items: any[], topic = '', subject = '') => {
  const cleaned = (Array.isArray(items) ? items : [])
    .map((item: any) => {
      const title = String(item?.title || `${topic} ${subject}` || 'Video').trim();
      const canonicalUrl = sanitizeYouTubeUrl(item?.url, title);
      return { title, url: canonicalUrl };
    });

  const seen = new Set<string>();
  const deduped: Array<{ title: string; url: string }> = [];
  for (const item of cleaned) {
    const key = item.url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push({ title: item.title, url: item.url });
  }

  return deduped;
};

const fetchValidYouTubeResources = async (topic: string, subject = '') => {
  const prompt = `Find 3 valid, playable YouTube educational video URLs for the topic "${topic}"${subject ? ` in subject "${subject}"` : ''}.
Rules:
- Return ONLY JSON array.
- Each item: {"title":"...","url":"https://www.youtube.com/watch?v=VIDEO_ID"}
- URL must be a direct watch URL with an 11-char VIDEO_ID.
- No shorts links, no playlists, no channels, no search URLs.`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: [{ parts: [{ text: prompt }] }],
      config: { tools: [{ googleSearch: {} }] }
    });
    const raw = result.text || '';
    const parsedArray = extractJsonArray(raw);
    if (Array.isArray(parsedArray) && parsedArray.length > 0) {
      const normalized = await normalizeYouTubeList(parsedArray, topic, subject);
      return normalized.slice(0, 3);
    }

    const parsedObject = extractJsonObject(raw) as any;
    const candidates = Array.isArray(parsedObject?.youtube) ? parsedObject.youtube : [];
    const normalized = await normalizeYouTubeList(candidates, topic, subject);
    return normalized.slice(0, 3);
  } catch (err) {
    console.warn('fetchValidYouTubeResources failed:', err);
    return [] as Array<{ title: string; url: string }>;
  }
};
export const aiService = {
  suggestResources: async (topic: string) => {
    const prompt = `Provide educational resources for the topic: "${topic}". Include 3 YouTube video links (placeholders if unknown) and 3 educational website links. Format as JSON with keys "youtube" and "websites", each being an array of objects with "title" and "url".`;
    
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' }
      });
      const raw = result.text || '';
      const parsed = extractJsonObject(raw);
      const clean = sanitizeResources(parsed, '', topic);

      let youtube = (await normalizeYouTubeList(clean.resources?.youtube || [], topic, '')).slice(0, 3);
      if (youtube.length < 2) {
        const generated = await fetchValidYouTubeResources(topic, '');
        if (generated.length > 0) youtube = generated;
      }
      const websites = (clean.resources?.websites || []).slice(0, 3);

      const withFallbackYoutube = youtube.length > 0
        ? youtube
        : [];

      const withFallbackWebsites = websites.length > 0
        ? websites
        : [
            { title: `${topic} - Wikipedia`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(topic.replace(/\s+/g, '_'))}` },
            { title: `${topic} - MDN/Docs`, url: sanitizeWebsiteUrl('', `${topic} documentation`, '', topic) },
            { title: `${topic} - Learning Resources`, url: sanitizeWebsiteUrl('', `${topic} learning resources`, '', topic) },
          ];

      // Keep backward-compatible shape used by UploadMaterial page.
      return { youtube: withFallbackYoutube, websites: withFallbackWebsites };
    } catch (err: any) {
      console.error('suggestResources error:', err?.message || err);
      return { youtube: [], websites: [] };
    }
  },

  generateQuestions: async (subject: string, topic: string, syllabus: string, count: number = 10) => {
    const prompt = `Generate ${count} multiple choice questions for the subject "${subject}" and topic "${topic}" based on this syllabus: "${syllabus}".
Return ONLY a JSON array. Each item must be:
{
  "question_text": "...",
  "option_a": "...",
  "option_b": "...",
  "option_c": "...",
  "option_d": "...",
  "correct_answer": "A|B|C|D"
}`;
    
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' }
      });
      const raw = result.text || '';
      const parsed = extractJsonArray(raw);
      return normalizeQuestions(parsed);
    } catch (err: any) {
      console.error('generateQuestions error:', err?.message || err);
      return [];
    }
  },

  generateAnswerKey: async (questions: string[]) => {
    const prompt = `Provide the correct answer keys (A, B, C, or D) for the following MCQ questions: ${JSON.stringify(questions)}. Format as a JSON object where keys are question indices (1, 2, ...) and values are the correct option.`;
    
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' }
      });
      const raw = result.text || '';
      try { return JSON.parse(raw || '{}'); } catch (e) { console.warn('generateAnswerKey non-JSON response', e); return {}; }
    } catch (err: any) {
      console.error('generateAnswerKey error:', err?.message || err);
      return {};
    }
  },

  getStaffRecommendations: async (subject: string, topic: string, description: string) => {
    const prompt = `As an expert educational content creator, find the best educational resources (YouTube videos and learning websites) for the following topic and then create a lesson plan based on them.
    Subject: ${subject}
    Topic: ${topic}
    Context/Description: ${description}

    Rules for links:
    - Provide only valid, fully qualified URLs starting with https://
    - No placeholders, no ellipsis (...), no example.com links
    - For YouTube, provide watch URLs like https://www.youtube.com/watch?v=VIDEO_ID or https://youtu.be/VIDEO_ID

    Return ONLY JSON with the following structure:
    {
      "objective": "A clear, measurable learning objective.",
      "resources": {
        "youtube": [{"title": "Video Title", "url": "https://youtube.com/..."}],
        "websites": [{"title": "Site Title", "url": "https://..."}]
      },
      "studyGuide": "A detailed, structured study guide (approx 300-500 words) that is strictly based on the recommended resources above. Use markdown for formatting.",
      "summary": "A 2-sentence summary of the lesson.",
      "keywords": ["Keyword 1", "Keyword 2"]
    }`;
    
    try {
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: [{ parts: [{ text: prompt }] }],
        // Tool use cannot be combined with responseMimeType: application/json.
        // Use search grounding and parse JSON from returned text.
        config: { tools: [{ googleSearch: {} }] }
      });

      const raw = result.text || '';
      try {
        const parsed = extractJsonObject(raw);
        const clean = sanitizeResources(parsed, subject, topic);
        let normalizedYoutube = await normalizeYouTubeList(clean.resources?.youtube || [], topic, subject);
        if (normalizedYoutube.length < 2) {
          const generated = await fetchValidYouTubeResources(topic, subject);
          if (generated.length > 0) normalizedYoutube = generated;
        }

        if (normalizedYoutube.length === 0) {
          clean.resources = {
            ...clean.resources,
            youtube: [],
          };
        } else {
          clean.resources = {
            ...clean.resources,
            youtube: normalizedYoutube,
          };
        }
        if (!Array.isArray(clean.resources?.websites) || clean.resources.websites.length === 0) {
          clean.resources = {
            ...clean.resources,
            websites: [
              { title: `${topic} Reference`, url: sanitizeWebsiteUrl('', `${subject} ${topic} reference`, subject, topic) },
              { title: `${topic} Tutorial`, url: sanitizeWebsiteUrl('', `${subject} ${topic} tutorial`, subject, topic) },
            ],
          };
        }
        return clean;
      } catch (jsonErr) {
        console.warn('AI returned non-JSON for staff recommendations — returning text fallback', jsonErr);
        return sanitizeResources({ raw: raw, resources: { youtube: [], websites: [] } }, subject, topic);
      }
    } catch (err: any) {
      console.error('getStaffRecommendations error:', err?.message || err);
      // fallback: return a minimal structure so callers don't break
      return sanitizeResources({
        objective: '',
        resources: { youtube: [], websites: [] },
        studyGuide: '',
        summary: '',
        keywords: []
      }, subject, topic);
    }
  }
};
