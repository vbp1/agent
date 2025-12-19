'use server';

import { generateText, Message } from 'ai';
import { getModelInstance } from '~/lib/ai/agent';
import { deleteMessagesByChatIdAfterTimestamp, getMessageById } from '~/lib/db/chats';
import { getUserSessionDBAccess } from '~/lib/db/db';

const MAX_TITLE_LENGTH = 80;

const TITLE_SYSTEM_PROMPT = `You are a chat title generator. Your ONLY job is to create a short title.

RULES:
- Output ONLY the title text, nothing else
- Maximum ${MAX_TITLE_LENGTH} characters
- No explanations, no answers to the user's question
- No quotes, colons, or special punctuation
- Summarize the TOPIC, don't answer it
- Use sentence case (capitalize first word only)

EXAMPLES:
User: "Are there any performance issues with my database?"
Title: Database performance check

User: "How do I optimize slow queries in PostgreSQL?"
Title: PostgreSQL slow query optimization

User: "What's causing high CPU usage on my RDS instance?"
Title: High CPU usage on RDS

User: "Can you analyze the pg_stat_statements output?"
Title: Analyze pg_stat_statements output

User: "Help me tune autovacuum settings"
Title: Autovacuum settings tuning`;

function extractMessageText(message: Message): string {
  if (typeof message.content === 'string') {
    return message.content;
  }
  if (Array.isArray(message.parts)) {
    return message.parts
      .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join(' ');
  }
  return '';
}

function createFallbackTitle(text: string): string {
  const cleaned = text
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length <= MAX_TITLE_LENGTH) {
    return cleaned;
  }

  const truncated = cleaned.slice(0, MAX_TITLE_LENGTH - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > MAX_TITLE_LENGTH / 2) {
    return truncated.slice(0, lastSpace) + '...';
  }
  return truncated + '...';
}

function validateAndCleanTitle(title: string, fallbackText: string): string {
  let cleaned = title
    .replace(/^["']|["']$/g, '')
    .replace(/^Title:\s*/i, '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length > MAX_TITLE_LENGTH) {
    const firstSentence = cleaned.split(/[.!?\n]/)[0]?.trim() ?? '';
    if (firstSentence.length <= MAX_TITLE_LENGTH && firstSentence.length >= 10) {
      cleaned = firstSentence;
    } else {
      cleaned = createFallbackTitle(cleaned);
    }
  }

  if (cleaned.length < 3 || cleaned.length > MAX_TITLE_LENGTH) {
    return createFallbackTitle(fallbackText);
  }

  return cleaned;
}

export async function generateTitleFromUserMessage({ message }: { message: Message }) {
  const messageText = extractMessageText(message);

  if (!messageText.trim()) {
    return 'New chat';
  }

  try {
    const { text: generatedTitle } = await generateText({
      model: await getModelInstance('title'),
      maxTokens: 40,
      experimental_telemetry: {
        isEnabled: true,
        metadata: {
          tags: ['internal', 'chat', 'title']
        }
      },
      system: TITLE_SYSTEM_PROMPT,
      prompt: messageText
    });

    return validateAndCleanTitle(generatedTitle, messageText);
  } catch (error) {
    console.error('Error generating title:', error);
    return createFallbackTitle(messageText) || 'New chat';
  }
}

export async function deleteTrailingMessages({ id }: { id: string }) {
  const dbAccess = await getUserSessionDBAccess();

  const [message] = await getMessageById(dbAccess, { id });
  if (!message) {
    throw new Error('Message not found');
  }

  await deleteMessagesByChatIdAfterTimestamp(dbAccess, {
    chatId: message.chatId,
    timestamp: message.createdAt
  });
}
