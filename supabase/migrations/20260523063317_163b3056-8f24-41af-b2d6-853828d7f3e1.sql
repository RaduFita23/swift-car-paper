ALTER TYPE public.document_type ADD VALUE IF NOT EXISTS 'itp';
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS itp_expira_la date;