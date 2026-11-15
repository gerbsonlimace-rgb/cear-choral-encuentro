# Roadmap

## Done
- Confirm Supabase backend is active and reachable (10 public tables, auth, storage).
- Fix preview typecheck errors:
  - `src/features/regent/regent-payment.server.ts` — removed duplicated payment fields in `PaymentDatabaseRow`.
  - `src/features/registration/registration-payment.server.ts` — repository now exposes `findByCpf` as required.
  - `src/features/registration/registration-payment.server.test.ts` — declared the `cpf` fixture constant.
  - Sponsor repository and generated Supabase types errors were stale and no longer reproduce.
- Transform the public registration form into a large-field, three-step wizard with review before payment.
- Show a live badge preview during personal details and keep the full price calculation card in payment review.
- Apply the dark-background logo on dark surfaces and the light-background logo on light surfaces.
- Compact the personal-data step and place the participant photo and event logo beside the name.
- Restore the full vertical badge with a lanyard on the right while keeping fields compact.
- Rebalance the sponsor area with square, left-aligned cards, larger logos, and hover effects.
- Put organisation and institutional support cards on the same line under one label.
- Make the organisation and institutional support cards horizontal strips, each half of the full row.
- Rework /admin/inscricoes with financial summary (received, pending, total expected — overall and per diocese) and participant avatars.
- Make the administrative summary the `/admin` home page and correct its fixed-navigation layout.
- Apply black navigation with white and gold states across desktop and mobile internal modules.
- Simplify `/admin/inscricoes` with e-mail, one payment column, no regent column, and row actions in a three-dot menu.
- Strengthen the WhatsApp/social link card with `og:site_name`, `og:locale`, and a correct sitemap URL in `robots.txt`.
- Clear the remaining typecheck errors in the checkout-replacement RPC call and align its contract test with the regenerated Supabase types.
- Restore the black (`bg-brand-ink`) sidebar and mobile bar in the internal shell, replacing the hardcoded zinc colour, and align both shell tests.
- Publish the photo-art editor at `/euvou`, redirect its old participant-only URL, and add a WhatsApp-ready social image.
- Add a "Grupo do encontro no WhatsApp" button to the participant home, linking to the event group chat.
- Fix administrator promotion and removal by restoring service-only write privileges; verify public roles remain denied.
- Show pending raffle amounts in the admin panel; each exempt-group participant has 20 raffle tickets equivalent to R$ 200, without changing participant or regent pages or checkouts.
- Add choir and musical-role filters to the admin registrations list, applied in the database query and kept in the CSV export.
- Publish the official contact (Pe. Lucas Soares, +55 85 9727-8622) on the home footer, the home registration section, and the registration page, from one shared module.
- Add user search to "Vincular usuário existente" in the admin regents panel, matching existing participants and regents by name or e-mail (with Auth e-mail fallback) so the admin can pick an account instead of typing it by hand.
- Adapt the Instagram access card to a white background and vertical 9:16 mobile/Reels format.
- Add an admin registrations filter identifying participants who have never logged in, preserving existing filters and CSV export.
- Open participant PDFs (scores and documents) full screen from "Abrir", with a dark header holding the title plus new-tab, download and close commands.
- Include an invitation in the participant video to share the EuVou photo and tag both the participant's choir Instagram and @corodiocesanoqxd (Coro de Quixadá), preserving real application captures and the narrated cheerful style.
- Add general total-registration and pending-initial-fee counters and an audited PDF export of the complete active-filter result; verify 115 tests, a 10-page PDF, and browser file delivery.
- Compact the summary and add audited PDF export by exact choir group; 64 tests passed, layouts and a three-page sample download checked; real-account verification remains blocked below.
- Complete Google Search Console setup using Gerbson's linked connection: live META verification succeeded, root property confirmed as siteOwner, and existing sitemap submitted successfully; 97 affected tests passed before final delivery.
- Let the admin "Marcar como pago" dialog record the amount received and either leave the remaining registration fee pending (with a later "Registrar restante da taxa" action) or waive it as a discount; 241 tests passed.
- Show the badge name (with full-name fallback) as the participant label in the admin registrations list, the CSV export and the registrations PDF, and match the badge name in the listing search; 197 admin tests plus 21 route tests passed.

## Open
- Fix reported PDF downloads in administrative summary and registrations; add filtered financial/raffle totals, registration count, and event logo above the PDF table.
- Finish SEO review: refreshed foundations all pass; verify and resolve stale Search Console and subpage sharing findings.
- Verify administrative PDF export end-to-end with real registrations (external Supabase session is unavailable to automated checks).
- Verify participant login and administrator promotion end-to-end (external Supabase session is unavailable to automated checks).
