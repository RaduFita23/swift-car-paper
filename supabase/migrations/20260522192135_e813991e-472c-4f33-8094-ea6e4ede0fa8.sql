
-- Strict contracts storage policies (replace permissive ones)
DROP POLICY IF EXISTS "contract_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "contract_storage_insert" ON storage.objects;

CREATE POLICY "contract_storage_select_party_or_admin" ON storage.objects FOR SELECT
USING (
  bucket_id = 'contracts' AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (t.seller_id = auth.uid() OR t.buyer_id = auth.uid())
    )
  )
);

CREATE POLICY "contract_storage_insert_party_or_admin" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'contracts' AND (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.id::text = (storage.foldername(name))[1]
        AND (t.seller_id = auth.uid() OR t.buyer_id = auth.uid())
    )
  )
);

CREATE POLICY "contract_storage_update_admin" ON storage.objects FOR UPDATE
USING (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "contract_storage_delete_admin" ON storage.objects FOR DELETE
USING (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'admin'));

-- Allow transaction counterparties to read each other's profile
CREATE POLICY "profiles_select_counterparty" ON public.profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE (t.seller_id = profiles.id AND t.buyer_id = auth.uid())
       OR (t.buyer_id = profiles.id AND t.seller_id = auth.uid())
  )
);
