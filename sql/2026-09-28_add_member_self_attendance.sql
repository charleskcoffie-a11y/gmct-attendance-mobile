-- Add secure member self-attendance for Sunday services.
-- Configure church_latitude, church_longitude, attendance_radius_meters,
-- and optionally attendance_timezone on the app_settings row before use.

ALTER TABLE IF EXISTS public.app_settings
  ADD COLUMN IF NOT EXISTS attendance_address TEXT,
  ADD COLUMN IF NOT EXISTS church_latitude NUMERIC,
  ADD COLUMN IF NOT EXISTS church_longitude NUMERIC,
  ADD COLUMN IF NOT EXISTS attendance_radius_meters NUMERIC DEFAULT 150,
  ADD COLUMN IF NOT EXISTS attendance_timezone TEXT DEFAULT 'America/Toronto';

UPDATE public.app_settings
SET attendance_address = COALESCE(attendance_address, '69 Milvan Drive, North York, Ontario M9L 1X9'),
    church_latitude = COALESCE(church_latitude, 43.754830),
    church_longitude = COALESCE(church_longitude, -79.556720),
    attendance_radius_meters = COALESCE(attendance_radius_meters, 150),
    attendance_timezone = COALESCE(attendance_timezone, 'America/Toronto')
WHERE id = 'app_settings';

CREATE OR REPLACE FUNCTION public.mark_member_self_attendance(
  p_latitude NUMERIC,
  p_longitude NUMERIC,
  p_accuracy_meters NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member public.members%ROWTYPE;
  v_settings public.app_settings%ROWTYPE;
  v_attendance_id UUID;
  v_date DATE;
  v_distance_meters NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to mark attendance';
  END IF;

  SELECT * INTO v_member
  FROM public.members
  WHERE LOWER(email) = LOWER(auth.jwt() ->> 'email')
    AND COALESCE(active, is_active, true) = true
  LIMIT 1;

  IF v_member.id IS NULL THEN
    RAISE EXCEPTION 'Active member profile not found';
  END IF;

  SELECT * INTO v_settings
  FROM public.app_settings
  WHERE id = 'app_settings'
  LIMIT 1;

  IF v_settings.church_latitude IS NULL OR v_settings.church_longitude IS NULL THEN
    RAISE EXCEPTION 'Church attendance location is not configured';
  END IF;

  IF p_latitude IS NULL OR p_longitude IS NULL
     OR p_latitude NOT BETWEEN -90 AND 90
     OR p_longitude NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'A valid location is required';
  END IF;

  IF p_accuracy_meters IS NOT NULL AND p_accuracy_meters > COALESCE(v_settings.attendance_radius_meters, 150) THEN
    RAISE EXCEPTION 'Location accuracy is too low. Please try again outside or near a window.';
  END IF;

  v_date := (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(v_settings.attendance_timezone, 'America/Toronto'))::DATE;

  IF EXTRACT(DOW FROM (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(v_settings.attendance_timezone, 'America/Toronto'))) <> 0 THEN
    RAISE EXCEPTION 'Self-attendance is available on Sundays only';
  END IF;

  v_distance_meters := 6371000 * 2 * ASIN(SQRT(
    POWER(SIN(RADIANS(p_latitude - v_settings.church_latitude) / 2), 2) +
    COS(RADIANS(v_settings.church_latitude)) * COS(RADIANS(p_latitude)) *
    POWER(SIN(RADIANS(p_longitude - v_settings.church_longitude) / 2), 2)
  ));

  IF v_distance_meters > COALESCE(v_settings.attendance_radius_meters, 150) THEN
    RAISE EXCEPTION 'You are outside the church attendance area';
  END IF;

  -- Serialize retries for the same member and Sunday before checking existing rows.
  PERFORM pg_advisory_xact_lock(hashtextextended(v_member.id::TEXT || ':' || v_date::TEXT, 0));

  SELECT ma.attendance_id INTO v_attendance_id
  FROM public.member_attendance ma
  JOIN public.attendance a ON a.id = ma.attendance_id
  WHERE ma.member_id = v_member.id
    AND ma.status = 'present'
    AND a.service_type = 'sunday'
    AND a.attendance_date::DATE = v_date
  LIMIT 1;

  IF v_attendance_id IS NOT NULL THEN
    RETURN jsonb_build_object('already_marked', true, 'attendance_id', v_attendance_id, 'attendance_date', v_date);
  END IF;

  SELECT id INTO v_attendance_id
  FROM public.attendance
  WHERE class_number = COALESCE(v_member.class_number, '')
    AND service_type = 'sunday'
    AND attendance_date::DATE = v_date
  ORDER BY attendance_date DESC
  LIMIT 1;

  IF v_attendance_id IS NULL THEN
    INSERT INTO public.attendance (
      class_number, attendance_date, service_type, class_leader_name,
      total_members_present, total_members_absent, total_visitors
    ) VALUES (
      COALESCE(v_member.class_number, ''), v_date, 'sunday', 'Member self-attendance', 0, 0, 0
    )
    RETURNING id INTO v_attendance_id;
  END IF;

  INSERT INTO public.member_attendance (
    attendance_id, member_id, member_name, class_number, status, absence_reason
  ) VALUES (
    v_attendance_id, v_member.id, v_member.name, COALESCE(v_member.class_number, ''), 'present', NULL
  )
  ON CONFLICT (attendance_id, member_id) DO UPDATE SET status = 'present';

  UPDATE public.attendance
  SET total_members_present = (
    SELECT COUNT(*) FROM public.member_attendance
    WHERE attendance_id = v_attendance_id AND status = 'present'
  )
  WHERE id = v_attendance_id;

  RETURN jsonb_build_object('already_marked', false, 'attendance_id', v_attendance_id, 'attendance_date', v_date);
END;
$$;

REVOKE ALL ON FUNCTION public.mark_member_self_attendance(NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_member_self_attendance(NUMERIC, NUMERIC, NUMERIC) TO authenticated;