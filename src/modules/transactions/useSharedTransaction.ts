import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SharedTransaction {
  id: string;
  status: string;
  type: "pf_pf" | "pf_pj" | "pj_pf" | "pj_pj";
  price: number | null;
  currency: string | null;
  seller_id: string;
  buyer_id: string | null;
  seller_approved_at: string | null;
  buyer_approved_at: string | null;
  vehicle: Record<string, any> | null;
  seller: Record<string, any> | null;
  buyer: Record<string, any> | null;
  has_contract: boolean;
}

/**
 * Hook care încarcă o tranzacție partajată după `share_token` și se abonează la
 * Supabase Realtime pentru sincronizare bidirecțională între vânzător și cumpărător.
 */
export function useSharedTransaction(token: string | undefined) {
  const [data, setData] = useState<SharedTransaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const txIdRef = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    if (!token) return;
    const { data: rows, error: rpcErr } = await supabase.rpc("get_shared_transaction", {
      p_token: token,
    });
    if (rpcErr) {
      setError(rpcErr.message);
      setData(null);
    } else {
      const row = (rows as SharedTransaction[] | null)?.[0] ?? null;
      setData(row);
      txIdRef.current = row?.id ?? null;
      setError(row ? null : "Link invalid sau tranzacție inexistentă");
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    setLoading(true);
    refresh();
  }, [refresh]);

  // Abonament Realtime: orice UPDATE pe rândul curent declanșează re-fetch.
  useEffect(() => {
    if (!data?.id) return;
    const channel = supabase
      .channel(`tx:${data.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "transactions", filter: `id=eq.${data.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "documents", filter: `transaction_id=eq.${data.id}` },
        () => refresh(),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "contracts", filter: `transaction_id=eq.${data.id}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.id, refresh]);

  return { data, loading, error, refresh };
}
