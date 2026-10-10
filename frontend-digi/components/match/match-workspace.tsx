"use client";

import { useEffect, useState } from "react";
import { getMatchOptions } from "@/lib/api/match";
import type { MatchRequest } from "@/lib/api/types";
import { buildMatchRequest, INITIAL_MATCH_VALUES, type MatchFormErrors, type MatchFormField, type MatchFormValues } from "@/lib/match/form";
import { FIELD_IDS, MatchForm, type OptionsState } from "./match-form";

export function MatchWorkspace() {
  const [values, setValues] = useState<MatchFormValues>(INITIAL_MATCH_VALUES);
  const [errors, setErrors] = useState<MatchFormErrors>({});
  const [options, setOptions] = useState<OptionsState>({ status: "loading" });
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const [, setSubmitted] = useState<MatchRequest | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getMatchOptions({ signal: controller.signal })
      .then((value) => setOptions({ status: "ready", value }))
      .catch(() => { if (!controller.signal.aborted) setOptions({ status: "error" }); });
    return () => controller.abort();
  }, [optionsAttempt]);

  const change = (patch: Partial<MatchFormValues>) => {
    setValues((current) => ({ ...current, ...patch }));
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !(field in patch))));
  };

  const submit = () => {
    const result = buildMatchRequest(values);
    setErrors(result.errors ?? {});
    if (result.errors) {
      const first = (Object.keys(FIELD_IDS) as MatchFormField[]).find((field) => result.errors[field]);
      if (first) document.getElementById(FIELD_IDS[first])?.focus();
      return;
    }
    setSubmitted(result.request);
  };

  return (
    <MatchForm
      values={values}
      errors={errors}
      options={options}
      onChange={change}
      onSubmit={submit}
      onRetryOptions={() => { setOptions({ status: "loading" }); setOptionsAttempt((n) => n + 1); }}
    />
  );
}
