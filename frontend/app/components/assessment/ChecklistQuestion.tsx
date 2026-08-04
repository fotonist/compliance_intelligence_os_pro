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
    <div className="border border-slate-800 rounded-md px-4 py-3 bg-slate-950">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-400">
            {question.dimension}
          </div>

          <div className="text-sm font-semibold text-slate-100">
            {question.title}
          </div>

          {question.description && (
            <div className="text-xs text-slate-500 mt-0.5">
              {question.description}
            </div>
          )}
        </div>

        <div className="text-xs px-2 py-1 rounded border border-slate-700 bg-slate-900 text-slate-300">
          {value ? value : "Not answered"}
        </div>
      </div>

      {/* Choices */}
      <div className="mt-3 flex flex-wrap gap-2">
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
