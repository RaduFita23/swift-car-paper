-- ─────────────────────────────────────────────────────────────────────────────
-- Shared Transaction Session: token de partajare, aprobări duale, RPCs publice
-- ─────────────────────────────────────────────────────────────────────────────

-- 1) Coloane noi pe transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS seller_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS buyer_approved_at  TIMESTAMPTZ;

-- Backfill rânduri existente (dacă sunt — `DEFAULT gen_random_uuid()` se aplică doar
-- la INSERT-uri noi în unele versiuni Postgres; ne asigurăm că toate au token).
UPDATE public.transactions
   SET share_token = gen_random_uuid()
 WHERE share_token IS NULL;

-- 2) Statusuri noi pentru flow-ul partajat
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'awaiting_buyer'
                  AND enumtypid = 'public.transaction_status'::regtype) THEN
    ALTER TYPE public.transaction_status ADD VALUE 'awaiting_buyer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'awaiting_approvals'
                  AND enumtypid = 'public.transaction_status'::regtype) THEN
    ALTER TYPE public.transaction_status ADD VALUE 'awaiting_approvals';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'completed'
                  AND enumtypid = 'public.transaction_status'::regtype) THEN
    ALTER TYPE public.transaction_status ADD VALUE 'completed';
  END IF;
END $$;

-- 3) Index pe token pentru lookup rapid
CREATE INDEX IF NOT EXISTS idx_transactions_share_token ON public.transactions(share_token);

-- 4) RPC public: fetch info despre o tranzacție prin token (fără auth necesar)
--    SECURITY DEFINER ocolește RLS și returnează doar câmpurile sigure.
CREATE OR REPLACE FUNCTION public.get_shared_transaction(p_token UUID)
RETURNS TABLE (
  id UUID,
  status public.transaction_status,
  type public.transaction_type,
  price NUMERIC,
  currency TEXT,
  seller_id UUID,
  buyer_id UUID,
  seller_approved_at TIMESTAMPTZ,
  buyer_approved_at TIMESTAMPTZ,
  vehicle JSONB,
  seller JSONB,
  buyer JSONB,
  has_contract BOOLEAN
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    t.id, t.status, t.type, t.price, t.currency,
    t.seller_id, t.buyer_id,
    t.seller_approved_at, t.buyer_approved_at,
    to_jsonb(v.*) AS vehicle,
    -- Date publice despre vânzător (nume/firmă/email) pentru afișare la cumpărător.
    jsonb_build_object(
      'person_type', sp.person_type,
      'nume', sp.nume, 'prenume', sp.prenume,
      'cnp', CASE WHEN auth.uid() = t.seller_id OR auth.uid() = t.buyer_id THEN sp.cnp ELSE NULL END,
      'serie_buletin', CASE WHEN auth.uid() = t.seller_id OR auth.uid() = t.buyer_id THEN sp.serie_buletin ELSE NULL END,
      'numar_buletin', CASE WHEN auth.uid() = t.seller_id OR auth.uid() = t.buyer_id THEN sp.numar_buletin ELSE NULL END,
      'adresa', CASE WHEN auth.uid() = t.seller_id OR auth.uid() = t.buyer_id THEN sp.adresa ELSE NULL END,
      'email', sp.email, 'telefon', sp.telefon,
      'denumire_firma', sp.denumire_firma, 'cui', sp.cui,
      'nr_reg_com', sp.nr_reg_com, 'reprezentant', sp.reprezentant
    ) AS seller,
    -- Date despre cumpărător (vizibile doar părților implicate).
    CASE
      WHEN auth.uid() IS NOT NULL AND (auth.uid() = t.seller_id OR auth.uid() = t.buyer_id)
        THEN jsonb_build_object(
          'person_type', bp.person_type,
          'nume', bp.nume, 'prenume', bp.prenume, 'cnp', bp.cnp,
          'serie_buletin', bp.serie_buletin, 'numar_buletin', bp.numar_buletin,
          'adresa', bp.adresa, 'email', bp.email, 'telefon', bp.telefon,
          'denumire_firma', bp.denumire_firma, 'cui', bp.cui,
          'nr_reg_com', bp.nr_reg_com, 'reprezentant', bp.reprezentant
        )
      ELSE NULL
    END AS buyer,
    EXISTS (SELECT 1 FROM public.contracts c WHERE c.transaction_id = t.id) AS has_contract
  FROM public.transactions t
  LEFT JOIN public.vehicles v  ON v.id = t.vehicle_id
  LEFT JOIN public.profiles sp ON sp.id = t.seller_id
  LEFT JOIN public.profiles bp ON bp.id = t.buyer_id
  WHERE t.share_token = p_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_shared_transaction(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_shared_transaction(UUID) TO anon, authenticated;

-- 5) RPC: cumpărătorul (autentificat) se alătură tranzacției pe baza tokenului.
CREATE OR REPLACE FUNCTION public.join_transaction_as_buyer(p_token UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nu ești autentificat' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tx FROM public.transactions WHERE share_token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tranzacție inexistentă' USING ERRCODE = 'P0002';
  END IF;

  IF v_tx.seller_id = auth.uid() THEN
    RETURN v_tx.id;  -- vânzătorul își poate accesa propria tranzacție prin link
  END IF;

  IF v_tx.buyer_id IS NOT NULL AND v_tx.buyer_id <> auth.uid() THEN
    RAISE EXCEPTION 'Această tranzacție are deja un cumpărător înregistrat'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.transactions
     SET buyer_id = auth.uid(),
         status = CASE WHEN status IN ('draft','docs_pending','awaiting_buyer')
                       THEN 'awaiting_approvals' ELSE status END
   WHERE id = v_tx.id;

  RETURN v_tx.id;
END;
$$;

REVOKE ALL ON FUNCTION public.join_transaction_as_buyer(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_transaction_as_buyer(UUID) TO authenticated;

-- 6) RPC: aprobă tranzacția (setează seller_approved_at sau buyer_approved_at).
CREATE OR REPLACE FUNCTION public.approve_transaction(p_token UUID)
RETURNS public.transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nu ești autentificat' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_tx FROM public.transactions WHERE share_token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tranzacție inexistentă' USING ERRCODE = 'P0002';
  END IF;

  IF auth.uid() = v_tx.seller_id THEN
    UPDATE public.transactions SET seller_approved_at = COALESCE(seller_approved_at, now())
     WHERE id = v_tx.id RETURNING * INTO v_tx;
  ELSIF auth.uid() = v_tx.buyer_id THEN
    UPDATE public.transactions SET buyer_approved_at = COALESCE(buyer_approved_at, now())
     WHERE id = v_tx.id RETURNING * INTO v_tx;
  ELSE
    RAISE EXCEPTION 'Nu ești parte în această tranzacție' USING ERRCODE = '42501';
  END IF;

  -- Marchează completed când ambele aprobări sunt în loc.
  IF v_tx.seller_approved_at IS NOT NULL AND v_tx.buyer_approved_at IS NOT NULL
     AND v_tx.status <> 'completed' THEN
    UPDATE public.transactions SET status = 'completed' WHERE id = v_tx.id
      RETURNING * INTO v_tx;
  END IF;

  RETURN v_tx;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_transaction(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_transaction(UUID) TO authenticated;

-- 7) RPC: revocă propria aprobare (în cazul în care utilizatorul vrea să modifice ceva)
CREATE OR REPLACE FUNCTION public.unapprove_transaction(p_token UUID)
RETURNS public.transactions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx public.transactions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Nu ești autentificat' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tx FROM public.transactions WHERE share_token = p_token FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tranzacție inexistentă' USING ERRCODE = 'P0002';
  END IF;

  IF auth.uid() = v_tx.seller_id THEN
    UPDATE public.transactions SET seller_approved_at = NULL,
       status = CASE WHEN status = 'completed' THEN 'awaiting_approvals' ELSE status END
     WHERE id = v_tx.id RETURNING * INTO v_tx;
  ELSIF auth.uid() = v_tx.buyer_id THEN
    UPDATE public.transactions SET buyer_approved_at = NULL,
       status = CASE WHEN status = 'completed' THEN 'awaiting_approvals' ELSE status END
     WHERE id = v_tx.id RETURNING * INTO v_tx;
  ELSE
    RAISE EXCEPTION 'Nu ești parte în această tranzacție' USING ERRCODE = '42501';
  END IF;

  RETURN v_tx;
END;
$$;

REVOKE ALL ON FUNCTION public.unapprove_transaction(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.unapprove_transaction(UUID) TO authenticated;

-- 8) Activează Realtime pe transactions, ca să se sincronizeze ambele ecrane.
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
