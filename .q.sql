select json_agg(json_build_object('t',term_code,'n',n,'at',at)) r from (select term_code, count(*) n, max(synced_at) at from course_sections group by 1 order by 1) x;
