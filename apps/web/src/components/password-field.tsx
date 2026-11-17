"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/field";
import { Button } from "@/components/ui/button";

// Campo de senha com botão de mostrar/ocultar. O botão é só uma conveniência de digitação:
// o valor continua indo no corpo da requisição, como antes.
export function PasswordField(props: Omit<React.ComponentProps<typeof Field>, "type" | "adornment">) {
  const [visible, setVisible] = useState(false);
  return (
    <Field
      {...props}
      type={visible ? "text" : "password"}
      className="pr-12"
      adornment={
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          className="absolute top-0 right-0"
          // Sem a palavra "senha" no nome: `getByLabel("Senha")` do E2E do login não pode casar com o botão.
          aria-label={visible ? "Ocultar caracteres" : "Mostrar caracteres"}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
        >
          {visible ? <EyeOffIcon aria-hidden="true" /> : <EyeIcon aria-hidden="true" />}
        </Button>
      }
    />
  );
}
