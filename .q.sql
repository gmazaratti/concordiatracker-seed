select json_build_object('ss',(select string_agg(column_name,',') from information_schema.columns where table_schema='public' and table_name='saved_schedules'),
 'tables',(select json_agg(table_name) from information_schema.tables where table_schema='public' and table_name ilike '%schedule%')) r;
