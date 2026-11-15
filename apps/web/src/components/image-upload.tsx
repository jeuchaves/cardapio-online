"use client";

import { useRef, useState } from "react";
import { ConfirmDelete } from "@/components/confirm-delete";
import { FormError, SuccessMessage, errorMessage } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const MAX_BYTES = 5 * 1024 * 1024;

// Envia a imagem em multipart (campo "file"). O tipo e o conteúdo são validados no backend;
// a checagem de tamanho aqui só poupa um envio inútil.
export function ImageUpload({
  label,
  imageUrl,
  uploadPath,
  removePath,
  onChanged,
}: {
  label: string;
  imageUrl: string | null;
  uploadPath: string;
  removePath?: string;
  onChanged: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setSuccess(null);
    if (file.size > MAX_BYTES) {
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }
    const body = new FormData();
    body.append("file", file);
    setBusy(true);
    try {
      await api(uploadPath, { method: "PUT", body });
      setSuccess("Imagem atualizada.");
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!removePath) return;
    setError(null);
    setSuccess(null);
    setBusy(true);
    try {
      await api(removePath, { method: "DELETE" });
      setSuccess("Imagem removida.");
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-3">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={label} className="size-16 rounded-md border object-cover" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-md border text-xs text-muted-foreground">
            Sem imagem
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {imageUrl ? "Trocar imagem" : "Enviar imagem"}
          </Button>
          {imageUrl && removePath ? (
            <ConfirmDelete
              label="Remover"
              title="Remover a imagem?"
              description="A imagem deixa de aparecer neste item."
              disabled={busy}
              onConfirm={remove}
            />
          ) : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          aria-label={label}
          onChange={upload}
        />
      </div>
      <p className="text-xs text-muted-foreground">JPEG, PNG ou WebP, até 5 MB.</p>
      <FormError message={error} />
      <SuccessMessage message={success} />
    </div>
  );
}
