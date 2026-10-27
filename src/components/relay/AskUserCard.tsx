"use client";

import { useTranslations } from "next-intl";
import { type KeyboardEvent, useReducer } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ASK_IDLE,
  type AskState,
  canSend,
  pendingAnswer,
  reduceAsk,
} from "@/lib/relay/askUserState";
import { DeclinedNote } from "./ConfirmCard";

type AskUserCardProps = {
  question: string;
  options: readonly string[];
  /** What a stored card already shows (answered or closed); idle while it waits for the user. */
  settled?: AskState;
  onChoose: (choice: string) => void;
};

type AnswerLineProps = { state: AskState };

/** The read-only result once a card is no longer waiting. */
function AnswerLine({ state }: AnswerLineProps) {
  const t = useTranslations("relay.ask");
  if (state.phase === "skipped") return <DeclinedNote automatic />;
  if (state.phase !== "sent" && state.phase !== "answeredViaComposer") {
    return null;
  }
  const key = state.phase === "sent" ? "answered" : "answeredViaComposer";
  return (
    <p data-testid="relay-ask-answer" className="text-muted-foreground">
      {t(key, { choice: state.answer })}
    </p>
  );
}

/** Lets the user pick an option or type their own answer, then Send (FR-42). */
export function AskUserCard({
  question,
  options,
  settled = ASK_IDLE,
  onChoose,
}: AskUserCardProps) {
  const t = useTranslations("relay.ask");
  const [local, dispatch] = useReducer(reduceAsk, ASK_IDLE);
  const state = settled.phase === "idle" ? local : settled;
  const open =
    state.phase === "idle" ||
    state.phase === "selected" ||
    state.phase === "typed";

  const send = () => {
    const answer = pendingAnswer(state);
    if (answer === null) return;
    dispatch({ type: "send" });
    onChoose(answer);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    send();
  };

  return (
    <div
      role="group"
      aria-label={t("cardLabel", { question })}
      data-testid="relay-ask-card"
      className="my-1.5 space-y-2 rounded-md border bg-card p-2 text-xs"
    >
      <p className="font-medium text-sm break-words">{question}</p>
      {open ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <Button
                key={option}
                type="button"
                size="xs"
                variant={
                  state.phase === "selected" && state.option === option
                    ? "default"
                    : "outline"
                }
                aria-pressed={
                  state.phase === "selected" && state.option === option
                }
                data-testid="relay-ask-option"
                onClick={() => dispatch({ type: "select", option })}
              >
                {option}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              data-testid="relay-ask-input"
              aria-label={t("inputLabel")}
              placeholder={t("inputPlaceholder")}
              value={state.phase === "typed" ? state.text : ""}
              onChange={(event) =>
                dispatch({ type: "type", text: event.target.value })
              }
              onKeyDown={handleKeyDown}
              className="h-7 text-xs"
            />
            <Button
              type="button"
              size="xs"
              data-testid="relay-ask-send"
              disabled={!canSend(state)}
              onClick={send}
            >
              {t("send")}
            </Button>
          </div>
        </div>
      ) : (
        <AnswerLine state={state} />
      )}
    </div>
  );
}
