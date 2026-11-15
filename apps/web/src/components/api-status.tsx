"use client";

import { useEffect, useState } from "react";

type Status = "checking" | "ok" | "down";

// Verificação da Fase 1: confirma que /api chega à API pela mesma origem.
export function ApiStatus() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    fetch("/api/v1/health")
      .then((response) => setStatus(response.ok ? "ok" : "down"))
      .catch(() => setStatus("down"));
  }, []);

  const label = {
    checking: "Verificando a API…",
    ok: "API disponível",
    down: "API indisponível",
  }[status];

  return <p role="status">{label}</p>;
}
