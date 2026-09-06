import { useEffect } from 'react';

const createSubscriptionInputSchema = {
  additionalProperties: false,
  properties: {
    name: { maxLength: 160, minLength: 1, type: 'string' },
    amount: { minimum: 0.01, multipleOf: 0.01, type: 'number' },
    currency: { enum: ['RUB', 'USD', 'EUR'], type: 'string' },
    billingPeriod: {
      enum: ['WEEK', 'MONTH', 'QUARTER', 'YEAR', 'CUSTOM'],
      type: 'string',
    },
    nextChargeDate: { format: 'date', type: 'string' },
    category: { maxLength: 64, type: 'string' },
  },
  required: ['name', 'amount', 'currency', 'billingPeriod', 'nextChargeDate'],
  type: 'object',
};

export function useSubscriptionWebMcp(onCreated: () => Promise<unknown>): void {
  useEffect(() => {
    const context = document.modelContext;

    if (!context?.registerTool) return;

    const lifecycle = new AbortController();

    void Promise.resolve(
      context.registerTool(
        {
          annotations: { readOnlyHint: false, untrustedContentHint: true },
          description: 'Создаёт регулярную подписку и обновляет список подписок на текущем экране.',
          async execute(input) {
            const { createSubscription, CreateSubscriptionBody } =
              await import('@subscription-manager/api-client');
            const values = CreateSubscriptionBody.parse(input);
            const subscription = await createSubscription(values);
            await onCreated();

            return {
              id: subscription.id,
              name: subscription.name,
              status: subscription.status,
            };
          },
          inputSchema: createSubscriptionInputSchema,
          name: 'create_subscription',
          title: 'Добавить подписку',
        },
        { signal: lifecycle.signal },
      ),
    ).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === 'AbortError') return;

      console.warn('Could not register create_subscription WebMCP tool', error);
    });

    return () => lifecycle.abort();
  }, [onCreated]);
}
