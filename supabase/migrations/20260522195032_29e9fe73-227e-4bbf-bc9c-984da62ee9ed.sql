CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  ocr  jsonb := COALESCE(meta->'ocr', '{}'::jsonb);
  dn   text  := NULLIF(ocr->>'data_nasterii', '');
  dn_date date;
BEGIN
  BEGIN
    dn_date := dn::date;
  EXCEPTION WHEN OTHERS THEN
    dn_date := NULL;
  END;

  INSERT INTO public.profiles (
    id, email, person_type,
    nume, prenume, cnp, serie_buletin, numar_buletin, adresa, data_nasterii,
    denumire_firma, cui, nr_reg_com, reprezentant, telefon
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((meta->>'person_type')::public.person_type, 'fizica'),
    NULLIF(ocr->>'nume',''),
    NULLIF(ocr->>'prenume',''),
    NULLIF(ocr->>'cnp',''),
    NULLIF(ocr->>'serie',''),
    NULLIF(ocr->>'numar',''),
    NULLIF(ocr->>'adresa',''),
    dn_date,
    NULLIF(ocr->>'denumire_firma',''),
    NULLIF(ocr->>'cui',''),
    NULLIF(ocr->>'nr_reg_com',''),
    NULLIF(ocr->>'reprezentant',''),
    NULLIF(ocr->>'telefon','')
  )
  ON CONFLICT (id) DO UPDATE SET
    person_type = EXCLUDED.person_type,
    nume = COALESCE(EXCLUDED.nume, public.profiles.nume),
    prenume = COALESCE(EXCLUDED.prenume, public.profiles.prenume),
    cnp = COALESCE(EXCLUDED.cnp, public.profiles.cnp),
    serie_buletin = COALESCE(EXCLUDED.serie_buletin, public.profiles.serie_buletin),
    numar_buletin = COALESCE(EXCLUDED.numar_buletin, public.profiles.numar_buletin),
    adresa = COALESCE(EXCLUDED.adresa, public.profiles.adresa),
    data_nasterii = COALESCE(EXCLUDED.data_nasterii, public.profiles.data_nasterii);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();