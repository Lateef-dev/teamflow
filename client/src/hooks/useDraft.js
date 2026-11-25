import { useState } from 'react';

/**
 * Local editable copy of a value that resets whenever the source changes
 * (e.g. a teammate renames the task while you have it open).
 */
export function useDraft(value) {
  const [draft, setDraft] = useState(value);
  const [source, setSource] = useState(value);
  if (source !== value) {
    setSource(value);
    setDraft(value);
  }
  return [draft, setDraft];
}
