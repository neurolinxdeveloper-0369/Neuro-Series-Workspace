import { useEffect, useRef, type ReactNode } from 'react';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return (
    <dialog ref={dialog} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }}
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl bg-white p-5 text-slate-900 shadow-xl backdrop:bg-slate-300/55 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <h2 className="pt-2 text-lg font-bold">{title}</h2>
        <button type="button" onClick={onClose} className="min-h-11 shrink-0 rounded-xl bg-slate-100 px-3 text-sm font-semibold">Close</button>
      </header>
      <div className="mt-4">{children}</div>
    </dialog>
  );
}
