-- Check member 1288 details
SELECT 
  id,
  member_number,
  name,
  class_number,
  email,
  active,
  created_at,
  updated_at
FROM public.members
WHERE member_number = '1288';
