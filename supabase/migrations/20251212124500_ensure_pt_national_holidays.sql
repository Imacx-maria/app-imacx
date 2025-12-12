-- Auto-generate Portugal national holidays (current+next year)

CREATE OR REPLACE FUNCTION public.ensure_pt_national_holidays(p_year int)
RETURNS void
LANGUAGE plpgsql
AS $function$
DECLARE
  a int;
  b int;
  c int;
  d int;
  e int;
  f int;
  g int;
  h int;
  i int;
  k int;
  l int;
  m int;
  easter_month int;
  easter_day int;
  easter_date date;
BEGIN
  IF p_year IS NULL THEN
    RETURN;
  END IF;

  -- Meeus/Jones/Butcher algorithm (Gregorian calendar)
  a := p_year % 19;
  b := floor(p_year / 100.0);
  c := p_year % 100;
  d := floor(b / 4.0);
  e := b % 4;
  f := floor((b + 8) / 25.0);
  g := floor((b - f + 1) / 3.0);
  h := (19 * a + b - d - g + 15) % 30;
  i := floor(c / 4.0);
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := floor((a + 11 * h + 22 * l) / 451.0);
  easter_month := floor((h + l - 7 * m + 114) / 31.0);
  easter_day := ((h + l - 7 * m + 114) % 31) + 1;
  easter_date := make_date(p_year, easter_month, easter_day);

  INSERT INTO public.feriados (holiday_date, description)
  SELECT v.holiday_date, v.description
  FROM (
    VALUES
      (make_date(p_year, 1, 1), 'Ano Novo'),
      (make_date(p_year, 4, 25), 'Dia da Liberdade'),
      (make_date(p_year, 5, 1), 'Dia do Trabalhador'),
      (make_date(p_year, 6, 10), 'Dia de Portugal'),
      (make_date(p_year, 8, 15), 'Assunção de Nossa Senhora'),
      (make_date(p_year, 10, 5), 'Implantação da República'),
      (make_date(p_year, 11, 1), 'Dia de Todos os Santos'),
      (make_date(p_year, 12, 1), 'Restauração da Independência'),
      (make_date(p_year, 12, 8), 'Imaculada Conceição'),
      (make_date(p_year, 12, 25), 'Natal'),
      (easter_date - 2, 'Sexta-feira Santa'),
      (easter_date, 'Páscoa'),
      (easter_date + 60, 'Corpo de Deus')
  ) AS v(holiday_date, description)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.feriados f
    WHERE f.holiday_date = v.holiday_date
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.ensure_pt_national_holidays(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_pt_national_holidays(int) TO service_role;

CREATE OR REPLACE FUNCTION public.calculate_working_days(start_date date, end_date date)
RETURNS integer
LANGUAGE plpgsql
AS $function$
DECLARE
  working_days integer := 0;
  curr_date date := start_date;
  start_year int;
  end_year int;
  y int;
BEGIN
  IF start_date IS NULL OR end_date IS NULL THEN
    RETURN NULL;
  END IF;

  IF end_date < start_date THEN
    RETURN 0;
  END IF;

  start_year := extract(year from start_date)::int;
  end_year := extract(year from end_date)::int;

  FOR y IN start_year..end_year LOOP
    PERFORM public.ensure_pt_national_holidays(y);
  END LOOP;

  WHILE curr_date <= end_date LOOP
    IF extract(dow from curr_date) NOT IN (0, 6)
      AND NOT EXISTS (
        SELECT 1
        FROM public.feriados
        WHERE holiday_date = curr_date
      ) THEN
      working_days := working_days + 1;
    END IF;
    curr_date := curr_date + 1;
  END LOOP;

  RETURN working_days;
END;
$function$;
