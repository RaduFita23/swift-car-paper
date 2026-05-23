import { useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy, Share2 } from "lucide-react";
import { toast } from "sonner";

interface ShareTransactionDialogProps {
  shareToken: string;
  carLabel?: string;
  /** Trigger custom (opțional). Implicit afișăm un Button. */
  trigger?: React.ReactNode;
}

/**
 * Dialog de partajare a sesiunii de tranzacționare către cumpărător.
 * Afișează QR code + link care poate fi copiat sau trimis prin WhatsApp.
 */
export function ShareTransactionDialog({ shareToken, carLabel, trigger }: ShareTransactionDialogProps) {
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/t/${shareToken}`;
  }, [shareToken]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiat");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nu s-a putut copia. Selectează manual.");
    }
  };

  const sendWhatsApp = () => {
    const text = encodeURIComponent(
      `Bună! Te invit să finalizăm vânzarea${carLabel ? ` pentru ${carLabel}` : ""}. Deschide linkul de pe telefon: ${url}`,
    );
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Share2 className="size-4 mr-2" /> Trimite cumpărătorului
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invită cumpărătorul</DialogTitle>
          <DialogDescription>
            Cumpărătorul deschide linkul sau scanează codul QR și își încarcă buletinul direct
            în această tranzacție. Vezi în timp real progresul.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-border p-4 grid place-items-center bg-white">
          <QRCodeSVG value={url} size={200} level="M" includeMargin />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Link partajabil</label>
          <div className="flex gap-2">
            <Input value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
            <Button variant="outline" size="icon" onClick={copy} aria-label="Copiază link">
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={sendWhatsApp}>
            Trimite pe WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
