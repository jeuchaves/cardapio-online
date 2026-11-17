"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Descrição longa recolhida em três linhas. "Ver mais" só aparece quando o texto realmente é cortado.
export function ExpandableText({ children, className }: { children: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const observer = useRef<ResizeObserver | null>(null);

  // Mede quando o elemento entra e quando muda de largura (a quebra de linha muda com a largura)
  const measure = (node: HTMLParagraphElement | null) => {
    observer.current?.disconnect();
    if (!node) return;
    const check = () => {
      if (!node.classList.contains("line-clamp-3")) return;
      setClamped(node.scrollHeight > node.clientHeight + 1);
    };
    observer.current = new ResizeObserver(check);
    observer.current.observe(node);
  };

  return (
    <div className="grid justify-items-start gap-1">
      <p ref={measure} className={cn("[overflow-wrap:anywhere]", !expanded && "line-clamp-3", className)}>
        {children}
      </p>
      {clamped || expanded ? (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-2"
        >
          {expanded ? "Ver menos" : "Ver mais"}
        </button>
      ) : null}
    </div>
  );
}
