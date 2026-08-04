"use client";

type MessageBoxProps = {
  open: boolean;
  type?: "success" | "error" | "warning" | "info";
  title?: string;
  message: string;
  onClose: () => void;
};

export default function MessageBox({
  open,
  type = "info",
  title,
  message,
  onClose,
}: MessageBoxProps) {
  if (!open) return null;

  const icon =
    type === "success"
      ? "✓"
      : type === "error"
      ? "✕"
      : type === "warning"
      ? "!"
      : "i";

  const iconColor =
    type === "success"
      ? "text-emerald-400"
      : type === "error"
      ? "text-red-400"
      : type === "warning"
      ? "text-amber-400"
      : "text-sky-400";

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">

      <div className="w-[420px] rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">

        <div className="flex flex-col items-center px-8 pt-8">

          <div className={`text-6xl font-light ${iconColor}`}>
            {icon}
          </div>

          {title && (
            <div className="mt-5 text-xl font-semibold text-white">
              {title}
            </div>
          )}

          <div className="mt-4 text-center text-slate-300">
            {message}
          </div>

        </div>

        <div className="mt-8 flex justify-center border-t border-slate-700 p-5">

          <button
            onClick={onClose}
            className="rounded-lg bg-sky-600 px-8 py-2 font-medium text-white hover:bg-sky-500"
          >
            OK
          </button>

        </div>

      </div>

    </div>
  );
}