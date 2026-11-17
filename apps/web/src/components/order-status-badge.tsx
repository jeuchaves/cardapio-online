import {
  BellRingIcon,
  CheckCheckIcon,
  ChefHatIcon,
  CircleCheckIcon,
  CircleXIcon,
  PackageCheckIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, type OrderStatus } from "@/lib/panel-orders";

// Status do pedido por texto, ícone e cor: a cor nunca é a única pista. Recebido, Confirmado e Em
// preparo usam os tokens de status (as variantes existentes eram quase iguais); Pronto usa a tinta
// cheia, Concluído o contorno e Cancelado o vermelho de erro. O oliva do acento não é cor de status.
const VISUAL: Record<
  OrderStatus,
  { variant: React.ComponentProps<typeof Badge>["variant"]; className?: string; Icon: typeof BellRingIcon }
> = {
  pending: { variant: "secondary", className: "bg-status-new text-status-new-foreground", Icon: BellRingIcon },
  confirmed: {
    variant: "secondary",
    className: "bg-status-confirmed text-status-confirmed-foreground",
    Icon: CircleCheckIcon,
  },
  preparing: {
    variant: "secondary",
    className: "bg-status-preparing text-status-preparing-foreground",
    Icon: ChefHatIcon,
  },
  ready: { variant: "secondary", className: "bg-foreground text-background", Icon: PackageCheckIcon },
  completed: { variant: "outline", Icon: CheckCheckIcon },
  cancelled: { variant: "destructive", Icon: CircleXIcon },
};

export function OrderStatusBadge({
  status,
  className,
  ...props
}: { status: OrderStatus } & Omit<React.ComponentProps<typeof Badge>, "variant" | "children">) {
  const { variant, className: tone, Icon } = VISUAL[status];
  return (
    <Badge variant={variant} className={cn(tone, className)} {...props}>
      <Icon />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
