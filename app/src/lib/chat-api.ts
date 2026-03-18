import type { IntentClassification } from '../types';

const BASE_URL = '/api';

export async function classifyIntent(message: string): Promise<IntentClassification> {
  const res = await fetch(`${BASE_URL}/chat/classify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error('Intent classification failed');
  return res.json();
}
