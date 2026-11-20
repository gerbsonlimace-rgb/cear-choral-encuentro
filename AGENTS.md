<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep `/euvou` as the public canonical photo-art route and redirect `/participante/minha-foto` to it, so shared links never require participant login.
- Compute admin raffle tracking separately from registration financial state so administrative obligations never change checkout eligibility or confirmed revenue.
- Filter administrative registration login history on the server using linked Auth user sign-in records before pagination and CSV export; account provisioning is not evidence of login.
- Generate administrative registration PDFs on the authorized server from the complete filtered dataset, audit their format separately, and prepare downloads before the final user click so mobile file delivery retains user activation.
- Match summary-card PDF exports by the exact stored choir name on the server, because the summary groups by name rather than configured choir ID.
- Embed the event artwork in administrative PDF generation and derive its financial summary from exported rows using the shared raffle separation rules, avoiding external asset requests and double-counted totals.
- Track partial manual registration-fee balances and administrator discounts in dedicated registration columns used only by admin accounting, so raffle complements, checkout eligibility and the shared financial state stay unchanged.
- Load the admin registrations listing, summary and exports from the single service-role-only `admin_registration_snapshot` database function and sign photos in a separate follow-up call, because each Supabase round trip dominates latency at this data size.
- Keep every administrative indicator (registration counters, financial totals and the per-choir breakdown) inside the registrations screen and drop the separate summary menu entry, so the administration has a single place for the overview and `/admin/resumo` only redirects to `/admin/inscricoes`.
- Render those indicators as compact metric cards and the per-choir breakdown as painted cards, so the registrations screen stays dense and scannable instead of growing into a long list of oversized boxes.
