-- Check members 1372 and 1288 status
SELECT 
  member_number,
  name,
  class_number,
  email,
  is_active,
  created_at,
  updated_at
FROM public.members
WHERE member_number IN ('1372', '1288')
ORDER BY member_number;
