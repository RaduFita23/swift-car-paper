
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.person_type AS ENUM ('fizica', 'juridica');
CREATE TYPE public.document_type AS ENUM ('buletin','cerere_inmatriculare','contract_vc','rca','plata_certificat','civ','talon');
CREATE TYPE public.transaction_type AS ENUM ('pf_pf','pf_pj','pj_pf','pj_pj');
CREATE TYPE public.transaction_status AS ENUM ('draft','docs_pending','ready','signed');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  person_type public.person_type NOT NULL DEFAULT 'fizica',
  email TEXT,
  nume TEXT,
  prenume TEXT,
  cnp TEXT,
  serie_buletin TEXT,
  numar_buletin TEXT,
  adresa TEXT,
  telefon TEXT,
  data_nasterii DATE,
  denumire_firma TEXT,
  cui TEXT,
  nr_reg_com TEXT,
  reprezentant TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Vehicles
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marca TEXT NOT NULL,
  model TEXT NOT NULL,
  an INT,
  vin TEXT,
  nr_inmatriculare TEXT,
  serie_civ TEXT,
  capacitate_cilindrica INT,
  culoare TEXT,
  km INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

-- Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  buyer_snapshot JSONB,
  vehicle_id UUID NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  type public.transaction_type NOT NULL,
  status public.transaction_status NOT NULL DEFAULT 'draft',
  price NUMERIC(12,2),
  currency TEXT DEFAULT 'EUR',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE,
  type public.document_type NOT NULL,
  storage_path TEXT NOT NULL,
  ocr_data JSONB,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Contracts (generated PDFs)
CREATE TABLE public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  pdf_path TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- RLS policies: profiles
CREATE POLICY "profiles_select_own_or_admin" ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own_or_admin" ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR public.has_role(auth.uid(),'admin'));

-- user_roles policies
CREATE POLICY "roles_select_own_or_admin" ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "roles_admin_all" ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- vehicles policies
CREATE POLICY "vehicles_select" ON public.vehicles FOR SELECT
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.vehicle_id = vehicles.id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())));
CREATE POLICY "vehicles_insert_own" ON public.vehicles FOR INSERT
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "vehicles_update_own_or_admin" ON public.vehicles FOR UPDATE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "vehicles_delete_own_or_admin" ON public.vehicles FOR DELETE
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- transactions policies
CREATE POLICY "tx_select" ON public.transactions FOR SELECT
  USING (seller_id = auth.uid() OR buyer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tx_insert_seller" ON public.transactions FOR INSERT
  WITH CHECK (seller_id = auth.uid());
CREATE POLICY "tx_update_parties_or_admin" ON public.transactions FOR UPDATE
  USING (seller_id = auth.uid() OR buyer_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "tx_delete_seller_or_admin" ON public.transactions FOR DELETE
  USING (seller_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- documents policies
CREATE POLICY "docs_select" ON public.documents FOR SELECT
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = documents.transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())));
CREATE POLICY "docs_insert_own" ON public.documents FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "docs_update_own_or_admin" ON public.documents FOR UPDATE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "docs_delete_own_or_admin" ON public.documents FOR DELETE
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- contracts policies
CREATE POLICY "contracts_select" ON public.contracts FOR SELECT
  USING (public.has_role(auth.uid(),'admin')
    OR EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = contracts.transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())));
CREATE POLICY "contracts_insert_party" ON public.contracts FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = contracts.transaction_id AND (t.buyer_id = auth.uid() OR t.seller_id = auth.uid())));

-- Trigger auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, person_type)
  VALUES (NEW.id, NEW.email, COALESCE((NEW.raw_user_meta_data->>'person_type')::public.person_type, 'fizica'))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_tx_updated BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Storage buckets (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('documents','documents', false)
  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts','contracts', false)
  ON CONFLICT (id) DO NOTHING;

-- Storage policies: documents (user folder = user_id)
CREATE POLICY "doc_storage_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "doc_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "doc_storage_update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "doc_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'documents' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "contract_storage_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'contracts' AND auth.uid() IS NOT NULL);
CREATE POLICY "contract_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'contracts' AND auth.uid() IS NOT NULL);
