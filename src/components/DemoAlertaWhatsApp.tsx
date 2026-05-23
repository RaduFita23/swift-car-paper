import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageCircle, Loader2 } from "lucide-react";

// Modulară: schimbă URL-ul webhook-ului n8n aici (sau prin prop `webhookUrl`).
// Pentru a o elimina, șterge importul și utilizarea componentei + acest fișier.
const DEFAULT_WEBHOOK_URL = "https://finalize-alphabet-twister.ngrok-free.dev/webhook-test/trimite-alerta";

export interface WebhookPayload {
  phone_number: string;
  data_expirare: string;
  tip_alerta: string;
}

interface DemoAlertaWhatsAppProps {
  webhookUrl?: string;
  payload?: Partial<WebhookPayload>;
  className?: string;
}

export default function DemoAlertaWhatsApp({
  webhookUrl = DEFAULT_WEBHOOK_URL,
  payload,
  className,
}: DemoAlertaWhatsAppProps) {
  const [loading, setLoading] = useState<boolean>(false);

  const trimiteNotificareWhatsApp = async (): Promise<void> => {
    setLoading(true);
    const body: WebhookPayload = {
      phone_number: payload?.phone_number ?? "+407xxxxxxxx",
      data_expirare: payload?.data_expirare ?? "1 Iunie 2026",
      tip_alerta: payload?.tip_alerta ?? "Verificarea ITP",
    };

    try {
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        toast.success("Mesajul a fost trimis către n8n!");
      } else {
        toast.error("Eroare la trimitere.");
      }
    } catch (error: unknown) {
      console.error("Eroare rețea:", error);
      toast.error("Eroare de rețea la trimiterea notificării.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={`p-6 max-w-sm ${className ?? ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <MessageCircle className="size-5 text-primary" />
        <h3 className="text-lg font-semibold">Sistem Alerte WhatsApp</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Testează trimiterea automată a notificării cu o săptămână înainte de expirare.
      </p>
      <Button onClick={trimiteNotificareWhatsApp} disabled={loading} className="w-full">
        {loading ? (
          <>
            <Loader2 className="size-4 mr-2 animate-spin" /> Se trimite...
          </>
        ) : (
          <>
            <MessageCircle className="size-4 mr-2" /> Testează Alertă Live
          </>
        )}
      </Button>
    </Card>
  );
}
