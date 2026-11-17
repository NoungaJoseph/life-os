begin;
select plan(4);
select has_table('public','savings_groups','group table exists');
select has_table('public','savings_group_contributions','contribution table exists');
select policies_are('public','savings_group_contributions',array['group_own_contributions'],'contributions are owner scoped');
select has_trigger('public','savings_groups','savings_group_no_delete_when_funded','funded group protection is installed');
select * from finish();
rollback;
