/** Convertește fișier în base64 (fără prefix data:) */
export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [meta, b64] = result.split(",");
      const mimeMatch = meta.match(/data:(.*?);base64/);
      resolve({ base64: b64, mimeType: mimeMatch?.[1] ?? file.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

import { supabase } from "@/integrations/supabase/client";

export async function ocrDocument(file: File, type: string) {
  const { base64, mimeType } = await fileToBase64(file);
  const { data, error } = await supabase.functions.invoke("ocr-document", {
    body: { imageBase64: base64, mimeType, type },
  });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return (data as any).data as Record<string, any>;
}
