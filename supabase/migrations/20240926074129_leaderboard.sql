CREATE OR REPLACE FUNCTION public.leaderboard()
 RETURNS TABLE(fid bigint, username text, display_name text, amount_received bigint, num_received bigint, pfp_url text)
 LANGUAGE sql
AS $function$
select * from (
  select distinct on (to_fid)
    to_fid as fid,
    to_username as username,
    to_display_name as display_name,
    sum(amount) over (partition by to_fid) as amount_received,
    count(*) over (partition by to_fid) as num_received,
    to_pfp_url as pfp_url
  from tip
  where is_valid is true
  order by to_fid, casted_at desc
) x
order by amount_received desc, fid asc
limit 100
$function$
;