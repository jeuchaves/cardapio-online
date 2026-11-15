import { SessionGate } from "@/components/session-gate";

export default function PlataformaLayout({ children }: { children: React.ReactNode }) {
  return <SessionGate area="plataforma">{children}</SessionGate>;
}
