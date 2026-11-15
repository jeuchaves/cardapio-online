import { SessionGate } from "@/components/session-gate";

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  return <SessionGate area="painel">{children}</SessionGate>;
}
