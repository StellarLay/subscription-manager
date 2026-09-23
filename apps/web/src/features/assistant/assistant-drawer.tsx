import {
  ApiError,
  cancelAssistantDraft,
  confirmAssistantDraft,
  sendAssistantMessage,
  type AssistantDraftDto,
} from '@subscription-manager/api-client';
import { Drawer, ScrollArea, Textarea } from '@mantine/core';
import {
  IconArrowUp,
  IconCheck,
  IconHelpCircle,
  IconList,
  IconPlus,
  IconSparkles,
} from '@tabler/icons-react';
import { useEffect, useRef, useState } from 'react';

import classes from './assistant-drawer.module.css';

interface AssistantDrawerProps {
  opened: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface ChatLine {
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  limitResetAt?: string;
}

const EXAMPLE = 'Netflix за 799 ₽ в месяц, списание 26 октября';

const periodLabels: Record<string, string> = {
  WEEK: 'каждую неделю',
  MONTH: 'каждый месяц',
  QUARTER: 'каждый квартал',
  YEAR: 'каждый год',
};

function complete(draft: AssistantDraftDto | null | undefined): boolean {
  return Boolean(
    draft?.name && draft.amount && draft.currency && draft.billingPeriod && draft.nextChargeDate,
  );
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Помощник сейчас не отвечает. Попробуй позже.';
}

function formatAmount(draft: AssistantDraftDto): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: draft.currency ?? 'RUB',
  }).format(draft.amount ?? 0);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00`));
}

export function AssistantDrawer({ opened, onClose, onCreated }: AssistantDrawerProps) {
  const [input, setInput] = useState('');
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState<AssistantDraftDto | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!opened) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
  }, [opened, lines, draft, busy]);

  const send = async (suggestedMessage?: string) => {
    const fromComposer = suggestedMessage === undefined;
    const message = (suggestedMessage ?? input).trim();
    if (!message || busy) return;
    if (fromComposer) setInput('');
    setLines((current) => [...current, { role: 'user', text: message }]);
    setBusy(true);
    try {
      const reply = await sendAssistantMessage({ message });
      setDraft(reply.draft ?? null);
      setLines((current) => [
        ...current,
        {
          role: 'assistant',
          text:
            reply.kind === 'draft' && complete(reply.draft)
              ? 'Собрал подписку. Проверь детали перед сохранением.'
              : reply.message,
        },
      ]);
    } catch (error) {
      if (fromComposer) setInput(message);
      setLines((current) => [
        ...current,
        error instanceof ApiError && error.status === 429 && error.body?.resetAt
          ? {
              role: 'assistant',
              text: error.message,
              limitResetAt: error.body.resetAt,
            }
          : { role: 'assistant', text: errorText(error), error: true },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const act = async (action: 'confirm' | 'cancel') => {
    if (!draft || busy) return;
    setBusy(true);
    try {
      const reply =
        action === 'confirm'
          ? await confirmAssistantDraft({ draftId: draft.id })
          : await cancelAssistantDraft({ draftId: draft.id });
      setDraft(null);
      setLines((current) => [...current, { role: 'assistant', text: reply.message }]);
      if (reply.kind === 'created') onCreated();
    } catch (error) {
      setLines((current) => [
        ...current,
        { role: 'assistant', text: errorText(error), error: true },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const useExample = () => {
    setInput(EXAMPLE);
    inputRef.current?.focus();
  };

  return (
    <Drawer
      classNames={{
        body: classes.body,
        close: classes.closeButton,
        content: classes.content,
        header: classes.header,
      }}
      onClose={onClose}
      opened={opened}
      position="right"
      size="min(100%, 460px)"
      title={
        <div className={classes.titleRow}>
          <span aria-hidden className={classes.titleIcon}>
            <IconSparkles size={20} stroke={1.9} />
          </span>
          <span className={classes.titleCopy}>
            <span className={classes.title}>Помощник Subsio</span>
            <span className={classes.titleCaption}>Подписки без лишних действий</span>
          </span>
          <button
            aria-label="Что умеет помощник"
            className={classes.helpButton}
            disabled={busy}
            onClick={() => void send('Что умеешь?')}
            title="Что умеет помощник"
            type="button"
          >
            <IconHelpCircle size={19} stroke={1.8} />
          </button>
        </div>
      }
    >
      <div className={classes.layout}>
        <ScrollArea className={classes.messages} offsetScrollbars viewportRef={viewportRef}>
          <div aria-live="polite" className={classes.conversation}>
            {lines.length === 0 && (
              <div className={classes.welcome}>
                <div aria-hidden className={classes.welcomeIcon}>
                  <IconSparkles size={28} stroke={1.7} />
                </div>
                <h2>Расскажи, что нужно</h2>
                <p>Помогу разобраться с подписками или добавить новую по обычному сообщению.</p>
                <div className={classes.suggestions}>
                  <button
                    className={classes.suggestion}
                    disabled={busy}
                    onClick={() => void send('Покажи мои подписки')}
                    type="button"
                  >
                    <IconList size={18} stroke={1.8} />
                    Мои подписки
                  </button>
                  <button
                    className={classes.suggestion}
                    disabled={busy}
                    onClick={useExample}
                    type="button"
                  >
                    <IconPlus size={18} stroke={1.8} />
                    Добавить подписку
                  </button>
                  <button
                    className={classes.suggestion}
                    disabled={busy}
                    onClick={() => void send('Что умеешь?')}
                    type="button"
                  >
                    <IconHelpCircle size={18} stroke={1.8} />
                    Что умеешь?
                  </button>
                </div>
                <p className={classes.welcomeNote}>
                  Ничего не сохранится без твоего подтверждения.
                </p>
              </div>
            )}
            {lines.map((line, index) => (
              <div
                className={line.role === 'user' ? classes.userRow : classes.assistantRow}
                key={index}
              >
                {line.role === 'assistant' && (
                  <span aria-hidden className={classes.assistantAvatar}>
                    <IconSparkles size={15} stroke={1.9} />
                  </span>
                )}
                <div
                  className={
                    line.limitResetAt
                      ? classes.limitBubble
                      : line.error
                        ? classes.errorBubble
                        : classes.messageBubble
                  }
                >
                  {line.limitResetAt ? (
                    <>
                      <strong>Лимит на сегодня исчерпан</strong>
                      <span>Лимит обновится в 00:00 по времени профиля.</span>
                    </>
                  ) : (
                    line.text
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className={classes.assistantRow}>
                <span aria-hidden className={classes.assistantAvatar}>
                  <IconSparkles size={15} stroke={1.9} />
                </span>
                <span aria-label="Помощник отвечает" className={classes.typing}>
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            )}
            {draft && complete(draft) && (
              <section aria-label="Черновик подписки" className={classes.draftCard}>
                <div className={classes.draftTopline}>
                  <span className={classes.draftEyebrow}>Черновик</span>
                  <span className={classes.draftStatus}>Не сохранено</span>
                </div>
                <h3 className={classes.draftName}>{draft.name}</h3>
                <p className={classes.draftAmount}>{formatAmount(draft)}</p>
                <div className={classes.draftDetails}>
                  <div className={classes.detailRow}>
                    <span>Периодичность</span>
                    <strong>
                      {periodLabels[draft.billingPeriod ?? ''] ?? draft.billingPeriod}
                    </strong>
                  </div>
                  <div className={classes.detailRow}>
                    <span>Следующее списание</span>
                    <strong>{formatDate(draft.nextChargeDate!)}</strong>
                  </div>
                  <div className={classes.detailRow}>
                    <span>Способ оплаты</span>
                    <strong>{draft.paymentMethodLabel ?? 'Не указан'}</strong>
                  </div>
                </div>
                <div className={classes.draftActions}>
                  <button
                    className={classes.confirmButton}
                    disabled={busy}
                    onClick={() => void act('confirm')}
                    type="button"
                  >
                    <IconCheck size={18} stroke={2} />
                    Добавить подписку
                  </button>
                  <button
                    className={classes.cancelButton}
                    disabled={busy}
                    onClick={() => void act('cancel')}
                    type="button"
                  >
                    Отменить черновик
                  </button>
                </div>
              </section>
            )}
            {draft && !complete(draft) && (
              <button
                className={classes.cancelDraftLink}
                disabled={busy}
                onClick={() => void act('cancel')}
                type="button"
              >
                Отменить черновик
              </button>
            )}
          </div>
        </ScrollArea>
        <div className={classes.composerArea}>
          <div className={classes.composer}>
            <Textarea
              aria-label="Сообщение помощнику"
              autosize
              classNames={{ input: classes.input }}
              disabled={busy}
              maxLength={1000}
              maxRows={4}
              minRows={1}
              onChange={(event) => setInput(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Напиши о подписке…"
              ref={inputRef}
              value={input}
            />
            <button
              aria-label="Отправить сообщение"
              className={classes.sendButton}
              disabled={!input.trim() || busy}
              onClick={() => void send()}
              type="button"
            >
              <IconArrowUp size={21} stroke={2.2} />
            </button>
          </div>
          <span className={classes.composerHint}>
            Enter — отправить · Shift+Enter — новая строка
          </span>
        </div>
      </div>
    </Drawer>
  );
}
