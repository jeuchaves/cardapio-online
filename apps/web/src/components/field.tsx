import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FieldProps = Omit<React.ComponentProps<typeof Input>, "id"> & {
  name: string;
  label: string;
  error?: string;
};

// O erro fica ligado ao campo (`aria-describedby`): o leitor de tela o anuncia junto do rótulo.
export function Field({ name, label, error, "aria-describedby": describedBy, ...props }: FieldProps) {
  const errorId = error ? `${name}-error` : undefined;
  const described = [describedBy, errorId].filter(Boolean).join(" ") || undefined;
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
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
