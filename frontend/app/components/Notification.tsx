"use client";

import { useEffect } from "react";

export type NotificationType =
  | "success"
  | "error"
  | "warning"
  | "info";

interface NotificationProps {
  type: NotificationType;
  title?: string;
  message: string;
  onClose: () => void;
  duration?: number;
}

const styles: Record<
  NotificationType,
  {
    container: string;
    icon: string;
  }
> = {
  success: {
    container: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: "✓",
  },
  error: {
    container: "border-red-200 bg-red-50 text-red-900",
    icon: "!",
  },
  warning: {
    container: "border-amber-200 bg-amber-50 text-amber-900",
    icon: "!",
  },
  info: {
    container: "border-blue-200 bg-blue-50 text-blue-900",
    icon: "i",
  },
};

export default function Notification({
  type,
  title,
  message,
  onClose,
  duration = 5000,
}: NotificationProps) {
  useEffect(() => {
    if (duration <= 0) return;

    const timer = window.setTimeout(() => {
      onClose();
    }, duration);

    return () => window.clearTimeout(timer);
  }, [duration, onClose]);

  const style = styles[type];

  return (
    <div
      role={type === "error" ? "alert" : "status"}
      className={`fixed right-6 top-6 z-[100] flex w-[420px] max-w-[calc(100vw-3rem)] items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${style.container}`}
    >
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold">
        {style.icon}
      </div>

      <div className="min-w-0 flex-1">
        {title && (
          <div className="text-sm font-bold">
            {title}
          </div>
        )}

        <div className="mt-0.5 text-sm leading-5">
          {message}
        </div>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close notification"
        className="shrink-0 rounded-md px-2 py-1 text-lg leading-none opacity-60 transition hover:bg-black/5 hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
