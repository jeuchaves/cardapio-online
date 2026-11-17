"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// QR gerado no navegador, só com a URL recebida (nada de token ou dado interno).
// O PNG de 600 px serve para imprimir.
export function QrCodeCard({ url, filename }: { url: string; filename: string }) {
  const [image, setImage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    QRCode.toDataURL(url, { width: 600, margin: 2, errorCorrectionLevel: "M" })
      .then((data) => current && setImage(data))
      .catch(() => current && setFailed(true));
    return () => {
      current = false;
    };
  }, [url]);

  return (
    <div className="grid justify-items-start gap-2">
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt={`QR Code para ${url}`} width={160} height={160} className="size-40 rounded-md border print:size-56" />
      ) : (
        <div className="size-40 rounded-md border bg-muted" aria-busy={!failed} />
      )}
      {failed ? (
        <p className="text-sm text-destructive">Não foi possível gerar o QR Code.</p>
      ) : null}
      <p className="text-sm break-all text-muted-foreground">{url}</p>
      {image ? (
        <a
          href={image}
          download={`${filename}.png`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "print:hidden")}
        >
          Baixar PNG
        </a>
      ) : null}
    </div>
  );
}
