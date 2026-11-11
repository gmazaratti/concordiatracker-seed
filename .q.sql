select json_build_object(
 'fn', pg_get_functiondef('public.send_admin_message'::regproc),
 'rows',(select json_agg(json_build_object('id',id,'to',recipient,'at',created_at,'seen',seen_at,'ack',acknowledged_at,'reply',left(reply,60))) from (select * from admin_messages order by created_at desc limit 12) m),
 'replies_fn_used', (select count(*) from pg_proc where proname='admin_message_replies')
) r;
