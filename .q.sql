select json_agg(json_build_object('n',polname,'cmd',polcmd,'q',pg_get_expr(polqual,polrelid))) r from pg_policy where polrelid='public.user_follows'::regclass;
