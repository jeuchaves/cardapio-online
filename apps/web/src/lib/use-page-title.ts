"use client";

import { useEffect } from "react";

const SITE = "Cardápio Digital";

// As telas do painel e da plataforma são componentes de cliente e não exportam `metadata`:
// o título da aba (e do histórico) é definido aqui, uma vez por tela.
export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} — ${SITE}`;
  }, [title]);
}
