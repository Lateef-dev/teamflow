'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAppDispatch } from '@/hooks/store';
import { createWorkspace, joinWorkspace } from '@/store/workspacesSlice';
import { Modal } from './Modal';
import { Button, Field, Input, Textarea } from './ui';

export interface ModalControl {
  open: boolean;
  onClose: () => void;
}

export function CreateWorkspaceModal({ open, onClose }: ModalControl) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const res = await dispatch(createWorkspace({ name, description }));
    setBusy(false);
    if (createWorkspace.fulfilled.match(res)) {
      onClose();
      router.push(`/w/${res.payload._id}`);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="New workspace" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Name" htmlFor="ws-name">
          <Input id="ws-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme product team" />
        </Field>
        <Field label="Description" htmlFor="ws-desc">
          <Textarea id="ws-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!name.trim()}>Create workspace</Button>
        </div>
      </form>
    </Modal>
  );
}

export function JoinWorkspaceModal({ open, onClose }: ModalControl) {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy(true);
    const res = await dispatch(joinWorkspace(code.trim()));
    setBusy(false);
    if (joinWorkspace.fulfilled.match(res)) {
      onClose();
      router.push(`/w/${res.payload._id}`);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Join a workspace" size="sm">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Invite code" htmlFor="invite" hint="Ask a workspace admin for the code. Try acme-demo for the demo workspace.">
          <Input id="invite" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. 3f9a1c2b7d" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={busy} disabled={!code.trim()}>Join</Button>
        </div>
      </form>
    </Modal>
  );
}
