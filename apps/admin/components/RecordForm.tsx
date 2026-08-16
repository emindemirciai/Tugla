'use client';

/**
 * Field-driven record form.
 *
 * The panel used to expose a JSON textarea for every catalogue. That is honest
 * about the stored shape but hostile to use: a missing brace loses the whole
 * entry, valid keys have to be memorised, and nothing tells you which values an
 * enum accepts. A field list gives real inputs, real choices and a label per
 * value, while the server keeps validating with the same Zod schema as before.
 */
import { useEffect, useState } from 'react';
import { t } from '../lib/i18n';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'checkbox'
  | 'select'
  | 'datetime'
  | 'rewards'
  | 'json';

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  /** Options for `select`. */
  options?: { value: string; label: string }[];
  /** Currencies offered by a `rewards` field. */
  currencies?: string[];
  hint?: string;
  placeholder?: string;
  required?: boolean;
  /** Rendered full width instead of in the two-column grid. */
  wide?: boolean;
}

type RecordValue = Record<string, unknown>;

const emptyValue = (field: Field): unknown => {
  switch (field.type) {
    case 'checkbox':
      return false;
    case 'number':
      return 0;
    case 'rewards':
      return {};
    case 'json':
      return {};
    default:
      return '';
  }
};

/** ISO timestamp → the `YYYY-MM-DDTHH:mm` shape a datetime-local input needs. */
const toLocalInput = (value: unknown) => {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
};

export function RecordForm({
  fields,
  initial,
  busy,
  onSubmit,
  onReset,
  submitLabel,
}: {
  fields: Field[];
  initial: RecordValue;
  busy: boolean;
  onSubmit: (value: RecordValue) => void;
  onReset: () => void;
  submitLabel: string;
}) {
  const [value, setValue] = useState<RecordValue>(initial);
  const [jsonErrors, setJsonErrors] = useState<Record<string, boolean>>({});

  // Editing an existing row replaces the draft: the form is a view of one
  // record, not a scratchpad that survives switching between them.
  useEffect(() => setValue(initial), [initial]);

  const set = (name: string, next: unknown) =>
    setValue((current) => ({ ...current, [name]: next }));

  const submit = () => {
    if (Object.values(jsonErrors).some(Boolean)) return;
    const payload: RecordValue = {};
    for (const field of fields) {
      const raw = value[field.name] ?? emptyValue(field);
      if (field.type === 'datetime') {
        // An empty date means "no date", which several endpoints treat as
        // draft/never-expires — sending an empty string would fail validation.
        payload[field.name] = raw ? new Date(String(raw)).toISOString() : null;
        continue;
      }
      if (field.type === 'number') {
        payload[field.name] = Number(raw);
        continue;
      }
      if (field.type === 'rewards') {
        const rewards = (raw as Record<string, unknown>) ?? {};
        payload[field.name] = Object.fromEntries(
          Object.entries(rewards)
            .map(([currency, amount]) => [currency, Number(amount)])
            .filter(([, amount]) => Number(amount) > 0),
        );
        continue;
      }
      payload[field.name] = raw;
    }
    onSubmit(payload);
  };

  return (
    <div className="record-form">
      <div className="record-grid">
        {fields.map((field) => {
          const raw = value[field.name] ?? emptyValue(field);
          const id = `field-${field.name}`;
          return (
            <div
              key={field.name}
              className={`record-field ${field.wide || field.type === 'textarea' ? 'record-wide' : ''}`}
            >
              <label htmlFor={id}>{field.label}</label>

              {field.type === 'textarea' && (
                <textarea
                  id={id}
                  rows={4}
                  value={String(raw)}
                  placeholder={field.placeholder}
                  onChange={(event) => set(field.name, event.target.value)}
                />
              )}

              {field.type === 'select' && (
                <select
                  id={id}
                  value={String(raw)}
                  onChange={(event) => set(field.name, event.target.value)}
                >
                  {(field.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}

              {field.type === 'checkbox' && (
                <input
                  id={id}
                  type="checkbox"
                  checked={Boolean(raw)}
                  onChange={(event) => set(field.name, event.target.checked)}
                />
              )}

              {field.type === 'number' && (
                <input
                  id={id}
                  type="number"
                  value={Number(raw)}
                  onChange={(event) => set(field.name, event.target.value)}
                />
              )}

              {field.type === 'datetime' && (
                <input
                  id={id}
                  type="datetime-local"
                  value={toLocalInput(raw)}
                  onChange={(event) => set(field.name, event.target.value)}
                />
              )}

              {field.type === 'rewards' && (
                <div className="reward-row">
                  {(field.currencies ?? []).map((currency) => (
                    <label key={currency} className="reward-input">
                      <span>{currency}</span>
                      <input
                        type="number"
                        min={0}
                        value={Number((raw as Record<string, unknown>)?.[currency] ?? 0)}
                        onChange={(event) =>
                          set(field.name, {
                            ...(raw as Record<string, unknown>),
                            [currency]: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}

              {field.type === 'json' && (
                <>
                  <textarea
                    id={id}
                    className="admin-json"
                    rows={4}
                    spellCheck={false}
                    defaultValue={JSON.stringify(raw ?? {}, null, 2)}
                    onChange={(event) => {
                      try {
                        set(field.name, JSON.parse(event.target.value || '{}'));
                        setJsonErrors((current) => ({ ...current, [field.name]: false }));
                      } catch {
                        setJsonErrors((current) => ({ ...current, [field.name]: true }));
                      }
                    }}
                  />
                  {jsonErrors[field.name] && (
                    <p className="admin-error">{t('catalog.jsonInvalid')}</p>
                  )}
                </>
              )}

              {field.type === 'text' && (
                <input
                  id={id}
                  value={String(raw)}
                  placeholder={field.placeholder}
                  required={field.required}
                  onChange={(event) => set(field.name, event.target.value)}
                />
              )}

              {field.hint && <small className="admin-sub">{field.hint}</small>}
            </div>
          );
        })}
      </div>

      <div className="admin-toolbar">
        <button type="button" className="primary" disabled={busy} onClick={submit}>
          {submitLabel}
        </button>
        <button type="button" onClick={onReset}>
          {t('catalog.newRecord')}
        </button>
      </div>
    </div>
  );
}
