"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Item = { id: string; name: string };

// Chips de categoria: âncoras reais (funcionam sem JavaScript) e destaque da categoria que está na
// tela, pela posição da rolagem. O chip ativo é levado para a área visível da própria barra.
export function CategoryNav({ categories }: { categories: Item[] }) {
  const [active, setActive] = useState<string | null>(categories[0]?.id ?? null);
  const navRef = useRef<HTMLElement>(null);

  // A categoria atual é a última cujo topo já passou da linha logo abaixo da barra fixa; no fim da
  // página, a última (que talvez nunca chegue a essa linha). Calculado a cada quadro de rolagem.
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = (navRef.current?.getBoundingClientRect().bottom ?? 0) + 16;
      const atBottom =
        window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
      let current = categories[0]?.id ?? null;
      if (atBottom) {
        current = categories[categories.length - 1]?.id ?? current;
      } else {
        for (const category of categories) {
          const section = document.getElementById(`categoria-${category.id}`);
          if (section && section.getBoundingClientRect().top <= line) current = category.id;
        }
      }
      setActive((previous) => (previous === current ? previous : current));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    // Imagens e fontes mudam a altura da página sem rolagem: recalcula quando o layout muda
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [categories]);

  useEffect(() => {
    const nav = navRef.current;
    const chip = nav?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!nav || !chip) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    nav.scrollTo({
      left: chip.offsetLeft - (nav.clientWidth - chip.offsetWidth) / 2,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [active]);

  return (
    <nav
      ref={navRef}
      aria-label="Categorias"
      className="sticky top-0 z-10 flex gap-2 overflow-x-auto border-b bg-background/95 px-4 py-2 backdrop-blur"
    >
      {categories.map((category) => {
        const current = category.id === active;
        return (
          <a
            key={category.id}
            href={`#categoria-${category.id}`}
            aria-current={current ? "true" : undefined}
            onClick={() => setActive(category.id)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm transition-colors",
              current ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
            )}
          >
            {category.name}
          </a>
        );
      })}
    </nav>
  );
}
