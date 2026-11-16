"use client";

import { ErrorState } from "@/components/list-states";

export default function RootError({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <main id="conteudo" tabIndex={-1} className="flex flex-1 flex-col justify-center outline-none">
      <ErrorState onRetry={() => unstable_retry()} />
    </main>
  );
}
