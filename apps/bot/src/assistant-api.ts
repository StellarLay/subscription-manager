import type { BotEnvironment } from './config.js';

export interface AssistantReply {
  kind: 'message' | 'draft' | 'created';
  message: string;
  draft: {
    id: string;
    name: string | null;
    amount: number | null;
    currency: string | null;
    billingPeriod: string | null;
    nextChargeDate: string | null;
  } | null;
}

export class AssistantApi {
  constructor(private readonly environment: BotEnvironment) {}

  get available(): boolean {
    return Boolean(this.environment.ASSISTANT_API_URL && this.environment.ASSISTANT_BOT_TOKEN);
  }

  async message(telegramId: number, message: string): Promise<AssistantReply> {
    return this.request('message', { telegramId, message });
  }

  async confirm(telegramId: number, draftId: string): Promise<AssistantReply> {
    return this.request('confirm', { telegramId, draftId });
  }

  async cancel(telegramId: number, draftId: string): Promise<AssistantReply> {
    return this.request('cancel', { telegramId, draftId });
  }

  private async request(route: string, body: object): Promise<AssistantReply> {
    const url = this.environment.ASSISTANT_API_URL;
    const token = this.environment.ASSISTANT_BOT_TOKEN;
    if (!url || !token) throw new Error('Assistant is not configured');
    const response = await fetch(`${url.replace(/\/$/, '')}/telegram/${route}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-subsio-internal-token': token },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(35000),
    });
    if (!response.ok) {
      const error = (await response.json().catch(() => null)) as { message?: string } | null;
      throw new Error(error?.message ?? 'Помощник сейчас не отвечает. Попробуй позже.');
    }
    return (await response.json()) as AssistantReply;
  }
}
