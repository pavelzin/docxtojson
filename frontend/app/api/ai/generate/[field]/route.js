import { NextResponse } from 'next/server';
import { initializeDatabase, prompts, queries } from '@/lib/database';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

let openai = null;
let initialized = false;
async function ensureInit() {
  if (!initialized) {
    await initializeDatabase();
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    initialized = true;
  }
}

const FIELD_MAP = {
  title_hotnews: 'titleHotnews',
  title_social: 'titleSocial',
  title_seo: 'titleSeo',
  tags: 'tags'
};

export async function POST(request, { params }) {
  try {
    await ensureInit();
    const fieldParam = params.field; // np. title_hotnews
    if (!FIELD_MAP[fieldParam]) {
      return NextResponse.json({ success: false, error: 'Nieobsługiwane pole' }, { status: 400 });
    }

    const { articleId } = await request.json();
    if (!articleId) {
      return NextResponse.json({ success: false, error: 'Brak articleId' }, { status: 400 });
    }

    const article = await queries.getArticleById(articleId);
    if (!article) {
      return NextResponse.json({ success: false, error: 'Artykuł nie istnieje' }, { status: 404 });
    }

    const promptRow = await prompts.getOne(fieldParam);
    const promptText = promptRow?.prompt_text || '';

    // Zbuduj kontekst
    const context = `TYTUŁ: ${article.title || ''}\nLEAD: ${article.lead || ''}\nTREŚĆ:\n${(article.description || '').replace(/<[^>]*>/g, ' ').slice(0, 8000)}`;

    const messages = [
      { role: 'system', content: 'Jesteś polskim redaktorem i specjalistą SEO/Social. Odpowiadasz wyłącznie wymaganym wynikiem, bez komentarzy.' },
      { role: 'user', content: `${promptText}\n\n${context}` }
    ];

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.7,
      max_tokens: 200,
      messages
    });

    let content = resp.choices?.[0]?.message?.content?.trim() || '';
    // Post-process dla tagów: rozbij po przecinkach do tablicy
    let value;
    if (fieldParam === 'tags') {
      value = content
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)
        .slice(0, 5);
    } else {
      value = content.replace(/^"|"$/g, '');
    }

    return NextResponse.json({ success: true, field: FIELD_MAP[fieldParam], value });
  } catch (e) {
    console.error('AI generation error:', e);
    return NextResponse.json({ success: false, error: 'Błąd generowania AI' }, { status: 500 });
  }
}


