"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Formulário de criação recolhido. Com a lista vazia (`forceOpen`) ele já aparece aberto,
// porque criar o primeiro item é a única ação possível. O formulário só existe no DOM
// quando aberto, para não duplicar `id` com o formulário de edição da lista.
export function NewItemCard({
  title,
  forceOpen,
  children,
}: {
  title: string;
  forceOpen: boolean;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const open = forceOpen || shown;
  const contentId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const wasForced = useRef(forceOpen);

  // Criar o primeiro item recolhe o formulário e remove o botão de criar, onde estava o foco:
  // devolve o foco ao botão de abrir, sem tirá-lo de quem já foi para outro lugar.
  useEffect(() => {
    if (wasForced.current && !forceOpen && document.activeElement === document.body) {
      toggleRef.current?.focus();
    }
    wasForced.current = forceOpen;
  }, [forceOpen]);

  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          {title}
          {forceOpen ? null : (
            <Button
              ref={toggleRef}
              type="button"
              size="lg"
              variant="outline"
              aria-expanded={open}
              aria-controls={open ? contentId : undefined}
              onClick={() => setShown(!shown)}
            >
              {open ? "Recolher" : "Abrir formulário"}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      {open ? <CardContent id={contentId}>{children}</CardContent> : null}
    </Card>
  );
}
