'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { ReflectionQuestionDto } from '@tadhkirah/contracts';
import { api, errorKey } from '@/lib/api';
import { Icon } from '../ui/icons';
import { Button, Input, Select, Status } from '../ui/primitives';

/** Show/hide, reorder and add your own reflection questions (REF-2). */
export function QuestionsEditor({
  questions,
  onChange,
}: {
  questions: ReflectionQuestionDto[];
  onChange: (q: ReflectionQuestionDto[]) => void;
}) {
  const t = useTranslations('reflection');
  const tq = useTranslations('reflection.questions');
  const te = useTranslations('errors');
  const [text, setText] = useState('');
  const [type, setType] = useState<ReflectionQuestionDto['answerType']>('yes_partly_no');
  const [error, setError] = useState<string | null>(null);
  const label = (q: ReflectionQuestionDto) =>
    q.catalogKey ? tq(q.catalogKey as 'tongue') : (q.text ?? '');

  async function toggle(q: ReflectionQuestionDto) {
    onChange(questions.map((x) => (x.id === q.id ? { ...x, enabled: !x.enabled } : x)));
    await api(`/reflection/questions/${q.id}`, {
      method: 'PATCH',
      body: { enabled: !q.enabled },
    }).catch(() => setError(te('generic')));
  }

  async function move(i: number, dir: -1 | 1) {
    const list = [...questions];
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j]!, list[i]!];
    onChange(list);
    await api('/reflection/questions/order', {
      method: 'PUT',
      body: { ids: list.map((q) => q.id) },
    }).catch(() => setError(te('generic')));
  }

  async function remove(q: ReflectionQuestionDto) {
    onChange(questions.filter((x) => x.id !== q.id));
    await api(`/reflection/questions/${q.id}`, { method: 'DELETE' }).catch(() =>
      setError(te('generic')),
    );
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    try {
      const q = await api<ReflectionQuestionDto>('/reflection/questions', {
        method: 'POST',
        body: { text: text.trim(), answerType: type },
      });
      onChange([...questions, q]);
      setText('');
      setError(null);
    } catch (err) {
      setError(te(errorKey(err)));
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <ul className="divide-y divide-border">
        {questions.map((q, i) => (
          <li key={q.id} className="flex items-center gap-3 py-2.5">
            <input
              type="checkbox"
              className="size-5 accent-[var(--primary)]"
              checked={q.enabled}
              onChange={() => toggle(q)}
              aria-label={`${t('shown')}: ${label(q)}`}
            />
            <span className={`flex-1 text-sm ${q.enabled ? '' : 'text-muted line-through'}`}>
              {label(q)}
            </span>
            <button
              type="button"
              aria-label="↑"
              onClick={() => move(i, -1)}
              className="rounded p-1 text-muted hover:text-primary"
            >
              <Icon name="arrow" size={16} className="-rotate-90" />
            </button>
            <button
              type="button"
              aria-label="↓"
              onClick={() => move(i, 1)}
              className="rounded p-1 text-muted hover:text-primary"
            >
              <Icon name="arrow" size={16} className="rotate-90" />
            </button>
            {!q.catalogKey && (
              <button
                type="button"
                onClick={() => remove(q)}
                className="text-xs text-muted hover:text-primary"
              >
                {t('remove')}
              </button>
            )}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
        <Input
          placeholder={t('newQuestionPlaceholder')}
          aria-label={t('addQuestion')}
          maxLength={200}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <Select
          aria-label={t('answerType')}
          value={type}
          onChange={(e) => setType(e.target.value as ReflectionQuestionDto['answerType'])}
        >
          {(['yes_partly_no', 'text', 'both'] as const).map((a) => (
            <option key={a} value={a}>
              {t(`answerTypes.${a}`)}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={!text.trim()}>
          {t('addQuestion')}
        </Button>
      </form>
      {error && <Status tone="error">{error}</Status>}
    </div>
  );
}
