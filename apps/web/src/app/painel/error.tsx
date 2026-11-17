"use client";

import { ErrorState } from "@/components/list-states";

export default function PainelError({ unstable_retry }: { unstable_retry: () => void }) {
  return <ErrorState onRetry={() => unstable_retry()} />;
}
