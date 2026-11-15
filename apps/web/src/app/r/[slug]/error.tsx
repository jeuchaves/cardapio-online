"use client";

import { Button } from "@/components/ui/button";

export default function PublicMenuError({ unstable_retry }: { unstable_retry: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-xl font-semibold">Não foi possível carregar o cardápio</h1>
      <p className="text-sm text-muted-foreground">Tente novamente em instantes.</p>
      <Button onClick={() => unstable_retry()}>Tentar novamente</Button>
    </main>
  );
}
