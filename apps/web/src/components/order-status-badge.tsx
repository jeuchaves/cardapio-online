import {
  BellRingIcon,
  CheckCheckIcon,
  ChefHatIcon,
  CircleCheckIcon,
  CircleXIcon,
  PackageCheckIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type OrderStatus } from "@/lib/panel-orders";

// Status do pedido por texto, ícone e as variantes que já existem: a cor nunca é a única pista.
const VISUAL: Record<
  OrderStatus,
  { variant: React.ComponentProps<typeof Badge>["variant"]; Icon: typeof BellRingIcon }
> = {
  pending: { variant: "default", Icon: BellRingIcon },
  confirmed: { variant: "secondary", Icon: CircleCheckIcon },
  preparing: { variant: "secondary", Icon: ChefHatIcon },
  ready: { variant: "secondary", Icon: PackageCheckIcon },
  completed: { variant: "outline", Icon: CheckCheckIcon },
  cancelled: { variant: "destructive", Icon: CircleXIcon },
};

export function OrderStatusBadge({
  status,
  ...props
}: { status: OrderStatus } & Omit<React.ComponentProps<typeof Badge>, "variant" | "children">) {
  const { variant, Icon } = VISUAL[status];
  return (
    <Badge variant={variant} {...props}>
      <Icon />
      {STATUS_LABELS[status]}
    </Badge>
  );
}
