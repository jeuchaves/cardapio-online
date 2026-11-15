"use client";

import { useRef } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

// Confirmação de ação destrutiva. A autorização continua no backend: o botão só é
// renderizado pelas telas para o dono.
export function ConfirmDelete({
  label = "Excluir",
  title,
  description,
  onConfirm,
  disabled,
}: {
  label?: string;
  title: string;
  description: string;
  onConfirm: () => void | Promise<void>;
  disabled?: boolean;
}) {
  // Trava síncrona: um segundo clique antes de a requisição terminar não reenvia a exclusão.
  const pending = useRef(false);
  async function confirm() {
    if (pending.current) return;
    pending.current = true;
    try {
      await onConfirm();
    } finally {
      pending.current = false;
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button size="sm" variant="outline" disabled={disabled} />}
      >
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={confirm}>
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
