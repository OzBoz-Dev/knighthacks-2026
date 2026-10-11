"use client";

import { Alert, Button, Stack, Text } from "@mantine/core";
import { useEffect, useRef, useState } from "react";
import { describeApiError } from "@/lib/api/client";
import { getMatchOptions, postMatch } from "@/lib/api/match";
import type { MatchRequest, MatchResponse } from "@/lib/api/types";
import { buildMatchRequest, DEMO_PRESET, formMatchesRequest, INITIAL_MATCH_VALUES, type MatchFormErrors, type MatchFormField, type MatchFormValues } from "@/lib/match/form";
import { createLatestRequest } from "@/lib/match/latest-request";
import { ErrorState, LoadingState } from "@/components/shared/async-state";
import { FadeIn } from "@/components/shared/fade-in";
import { FIELD_IDS, MatchForm, type OptionsState } from "./match-form";
import { MatchResults } from "./match-results";

type MatchState =
  | { status: "idle" }
  | { status: "loading"; request: MatchRequest }
  | { status: "success"; request: MatchRequest; response: MatchResponse }
  | { status: "error"; request: MatchRequest; message: string };

export function MatchWorkspace() {
  const [values, setValues] = useState<MatchFormValues>(INITIAL_MATCH_VALUES);
  const [errors, setErrors] = useState<MatchFormErrors>({});
  const [options, setOptions] = useState<OptionsState>({ status: "loading" });
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const [match, setMatch] = useState<MatchState>({ status: "idle" });
  const [latest] = useState(createLatestRequest);
  const loadingRequest = useRef<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getMatchOptions({ signal: controller.signal })
      .then((value) => setOptions({ status: "ready", value }))
      .catch(() => { if (!controller.signal.aborted) setOptions({ status: "error" }); });
    return () => controller.abort();
  }, [optionsAttempt]);

  useEffect(() => () => latest.cancel(), [latest]);

  const run = (request: MatchRequest) => {
    const key = JSON.stringify(request);
    if (loadingRequest.current === key) return;
    const { signal, isCurrent } = latest.start();
    loadingRequest.current = key;
    setMatch({ status: "loading", request });
    postMatch(request, { signal })
      .then((response) => { if (isCurrent()) setMatch({ status: "success", request, response }); })
      .catch((error: unknown) => { if (isCurrent()) setMatch({ status: "error", request, message: describeApiError(error) }); })
      .finally(() => { if (isCurrent()) loadingRequest.current = null; });
  };

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
    run(result.request);
  };

  const outdated = match.status === "success" && !formMatchesRequest(values, match.request);

  return (
    <Stack gap="lg">
      <FadeIn delay={60}>
      <MatchForm
        values={values}
        errors={errors}
        options={options}
        busy={match.status === "loading"}
        actions={<Button type="button" variant="default" size="sm" onClick={() => change(DEMO_PRESET)}>Demo preset</Button>}
        onChange={change}
        onSubmit={submit}
        onRetryOptions={() => { setOptions({ status: "loading" }); setOptionsAttempt((n) => n + 1); }}
      />
      </FadeIn>
      {match.status === "idle" && <Text c="dimmed" fz={14}>Enter your requirements, then select Find matches.</Text>}
      {match.status === "loading" && <LoadingState label="Finding matches…" rows={3} />}
      {match.status === "error" && <ErrorState title="Couldn't find matches" message={`${match.message} Your requirements are kept, so you can try again.`} onRetry={() => run(match.request)} />}
      {match.status === "success" && (
        <>
          {outdated && <Alert color="gray" role="status">These results are for your last search. Select Find matches to use your changes.</Alert>}
          <MatchResults response={match.response} request={match.request} />
        </>
      )}
    </Stack>
  );
}
