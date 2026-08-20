"use client";

import React from "react";
import ChecklistChoice from "./ChecklistChoice";

export type ChecklistChoiceDTO = {
  key: string;
  label: string;
};

export type ChecklistQuestionDTO = {
  id: number;
  title: string;
  description?: string | null;
  dimension: "likelihood" | "impact" | string;
  choices: ChecklistChoiceDTO[];
};

type Props = {
  question: ChecklistQuestionDTO;
  value?: string;
  disabled?: boolean;
  onChange: (questionId: number, choiceKey: string) => void;
};

export default function ChecklistQuestion({
  question,
  value,
  disabled,
  onChange,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {question.dimension}
          </div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {question.title}
          </div>
          {question.description && (
            <div className="mt-1 text-xs leading-5 text-slate-500">
              {question.description}
            </div>
          )}
        </div>

        <div className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
          {value ? value : "Not answered"}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {question.choices?.map((c) => (
          <ChecklistChoice
            key={c.key}
            label={c.label}
            checked={value === c.key}
            disabled={disabled}
            onSelect={() => onChange(question.id, c.key)}
          />
        ))}
      </div>
    </div>
  );
}
