import fetch from 'node-fetch';

const DEFAULT_SYSTEM_PROMPT = `You are an assistant supporting veterinary oncology data analysis in Nigeria. You can summarise data, suggest possible differentials, and highlight data issues. You must NOT replace professional veterinary judgement. Do not give definitive treatment plans or guarantees. Be concise and factual.`;

type ChatMode = "general" | "db_only";

interface ChatGPTParams {
  systemPrompt?: string;
  userMessage: string;
  context?: string;
  mode?: ChatMode;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export async function callChatGPT({
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  userMessage,
  context,
  mode = "general",
}: ChatGPTParams): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  if (!apiKey) {
    console.error('OPENAI_API_KEY environment variable is not set');
    throw new Error('OpenAI API key is not configured');
  }

  const messages: OpenAIMessage[] = [];

  if (mode === "db_only") {
    // DB-only mode: only use provided context, no general knowledge
    messages.push({
      role: 'system',
      content: "You must ANSWER ONLY using the context provided. If the context does not contain enough information, say you do not know. Do not use outside knowledge. This is not a substitute for professional veterinary judgement.",
    });
    messages.push({
      role: 'system',
      content: `Context from VetOncoData:\n${context || "NO CONTEXT PROVIDED"}`,
    });
  } else {
    // General mode: allow general knowledge, include context if provided
    messages.push({
      role: 'system',
      content: systemPrompt,
    });
    if (context) {
      messages.push({
        role: 'system',
        content: `Here is relevant data from the VetOncoData database:\n${context}`,
      });
    }
  }

  messages.push({ role: 'user', content: userMessage });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', {
        status: response.status,
        statusText: response.statusText,
        body: errorData,
      });
      throw new Error(`OpenAI API returned status ${response.status}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const assistantMessage = data.choices[0]?.message?.content;

    if (!assistantMessage) {
      console.error('No message content in OpenAI response');
      throw new Error('Invalid response format from OpenAI API');
    }

    return assistantMessage;
  } catch (error) {
    console.error('Error calling ChatGPT:', error);
    throw error;
  }
}
