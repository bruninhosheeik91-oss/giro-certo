CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, city, start_date)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'Usuário'
    ),
    NEW.raw_user_meta_data ->> 'city',
    (now() AT TIME ZONE 'America/Sao_Paulo')::date
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id, selected_month)
  VALUES (
    NEW.id,
    date_trunc('month', now() AT TIME ZONE 'America/Sao_Paulo')::date
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;
