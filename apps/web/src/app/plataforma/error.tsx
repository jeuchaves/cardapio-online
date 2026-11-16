"use client";

import { ErrorState } from "@/components/list-states";

export default function PlataformaError({ unstable_retry }: { unstable_retry: () => void }) {
  return <ErrorState onRetry={() => unstable_retry()} />;
}
