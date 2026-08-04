"use client";

type Props = {
  title: string;
  message: string;
  onConfirm: () => void;
  confirmText?: string;
};

export default function DeleteConfirmModal({
  title,
  message,
  onConfirm,
  confirmText = "OK",
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-950 p-5">
        <div className="text-base font-semibold text-white">{title}</div>

        <div className="mt-3 text-sm text-slate-300">{message}</div>

        <div className="mt-5 flex justify-end">
          <button
            onClick={onConfirm}
            className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
