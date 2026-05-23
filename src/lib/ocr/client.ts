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

/**
 * Apelează edge function-ul `ocr-document`.
 * Acceptă fie un singur File, fie un array (ex: pentru talon — față + verso),
 * caz în care toate imaginile sunt trimise împreună într-o singură cerere
 * spre modelul de Vision LLM.
 */
export async function ocrDocument(file: File | File[], type: string) {
  const files = Array.isArray(file) ? file : [file];
  const images = await Promise.all(files.map(fileToBase64));

  const body = images.length === 1
    ? { imageBase64: images[0].base64, mimeType: images[0].mimeType, type }
    : { imageBase64s: images, type };

  const { data, error } = await supabase.functions.invoke("ocr-document", { body });
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return (data as any).data as Record<string, any>;
}
