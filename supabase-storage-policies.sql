create policy "Pulse verified Firebase users upload own temp files"
on storage.objects for insert to authenticated
with check (bucket_id = 'pulse-temp-files' and (storage.foldername(name))[1] = (select auth.uid()::text) and coalesce((select auth.jwt()->>'email_verified')::boolean, false) = true);

create policy "Pulse verified Firebase users download temp files"
on storage.objects for select to authenticated
using (bucket_id = 'pulse-temp-files' and coalesce((select auth.jwt()->>'email_verified')::boolean, false) = true);

create policy "Pulse verified Firebase users delete delivered temp files"
on storage.objects for delete to authenticated
using (bucket_id = 'pulse-temp-files' and coalesce((select auth.jwt()->>'email_verified')::boolean, false) = true);
