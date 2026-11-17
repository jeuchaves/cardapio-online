import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = Omit<React.ComponentProps<typeof Input>, "id"> & {
  name: string;
  label: string;
  error?: string;
  hint?: string;
};

// O erro e a dica ficam ligados ao campo (`aria-describedby`): o leitor de tela os anuncia junto do rótulo.
export function Field({ name, label, error, hint, "aria-describedby": describedBy, ...props }: FieldProps) {
  const errorId = error ? `${name}-error` : undefined;
  const hintId = hint ? `${name}-hint` : undefined;
  const described = [describedBy, hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={described}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
