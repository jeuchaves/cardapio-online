"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

// A senha temporária só existe nesta resposta: o painel a mostra uma vez, sem guardá-la
// em storage, URL ou log. Ao fechar, ela não pode ser recuperada (gera-se outra).
export function TemporaryPassword({
  title,
  password,
  onClose,
}: {
  title: string;
  password: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Alert>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="grid gap-3">
        <p>
          Anote ou copie agora: ela <strong>não será exibida novamente</strong>. A pessoa terá que
          trocá-la no primeiro acesso.
        </p>
        <code className="w-fit rounded bg-muted px-2 py-1 font-mono text-base">{password}</code>
        <div className="flex gap-2">
          <Button type="button" size="sm" onClick={copy}>
            {copied ? "Copiada" : "Copiar"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onClose}>
            Já anotei
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
