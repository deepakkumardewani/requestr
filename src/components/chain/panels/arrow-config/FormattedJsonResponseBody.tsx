"use client";

import { memo, useMemo } from "react";
import { prettyPrintJson } from "@/lib/chainJson";

type FormattedJsonResponseBodyProps = {
  body: string;
};

/** Pretty-prints JSON when valid; otherwise shows the raw body string. */
export const FormattedJsonResponseBody = memo(
  function FormattedJsonResponseBody({ body }: FormattedJsonResponseBodyProps) {
    const text = useMemo(() => prettyPrintJson(body), [body]);

    return <pre className="text-foreground whitespace-pre-wrap">{text}</pre>;
  },
);
