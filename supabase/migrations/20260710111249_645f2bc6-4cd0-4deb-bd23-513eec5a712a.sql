-- Seed Super Admin: thedinjoaopedro@gmail.com
DO $$
DECLARE
  _uid uuid;
  _email text := 'thedinjoaopedro@gmail.com';
  _password text := 'Jander00*';
BEGIN
  SELECT id INTO _uid FROM auth.users WHERE email = _email;

  IF _uid IS NULL THEN
    _uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      _uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      _email, crypt(_password, gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Administrador Geral"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), _uid, _uid::text, jsonb_build_object('sub', _uid::text, 'email', _email), 'email', now(), now(), now());
  ELSE
    UPDATE auth.users
      SET encrypted_password = crypt(_password, gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, now()),
          updated_at = now()
      WHERE id = _uid;
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (_uid, _email, 'Administrador Geral')
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, 'super_admin')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.account_access (user_id, status, valid_until)
  VALUES (_uid, 'approved', NULL)
  ON CONFLICT (user_id) DO UPDATE SET status = 'approved', valid_until = NULL, updated_at = now();
END $$;