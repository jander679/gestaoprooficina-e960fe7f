
CREATE EXTENSION IF NOT EXISTS citext;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username citext;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique
  ON public.profiles (username) WHERE username IS NOT NULL;

-- Resolve o e-mail interno associado a um username, para o cliente conseguir chamar signInWithPassword.
CREATE OR REPLACE FUNCTION public.resolve_username_email(_username text)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _email text;
BEGIN
  SELECT p.email INTO _email
  FROM public.profiles p
  WHERE p.username = _username::citext
  LIMIT 1;
  RETURN _email;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_username_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_username_email(text) TO anon, authenticated;

-- Ajusta handle_new_user: se metadados dizem "created_by_admin=true", já aprova e grava username.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _username text := NEW.raw_user_meta_data->>'username';
  _created_by_admin boolean := COALESCE((NEW.raw_user_meta_data->>'created_by_admin')::boolean, false);
BEGIN
  INSERT INTO public.profiles (id, email, full_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NULLIF(_username, '')
  )
  ON CONFLICT (id) DO UPDATE SET
    username = COALESCE(EXCLUDED.username, public.profiles.username);

  INSERT INTO public.account_access (user_id, status)
  VALUES (NEW.id, CASE WHEN _created_by_admin THEN 'approved'::account_status ELSE 'pending'::account_status END)
  ON CONFLICT (user_id) DO NOTHING;

  IF (SELECT COUNT(*) FROM public.user_roles WHERE role='super_admin') = 0 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
    UPDATE public.account_access SET status = 'approved' WHERE user_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;
