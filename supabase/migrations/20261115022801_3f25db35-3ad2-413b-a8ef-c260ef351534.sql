CREATE OR REPLACE FUNCTION public.admin_registration_snapshot(p_search text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := btrim(coalesce(p_search, ''));
  v_pattern text;
  v_cpf_pattern text;
  v_digits text;
  v_result jsonb;
BEGIN
  IF v_search <> '' THEN
    v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
    v_digits := regexp_replace(v_search, '\D', '', 'g');
    v_cpf_pattern := CASE WHEN v_digits <> '' THEN '%' || v_digits || '%' ELSE v_pattern END;
  END IF;

  WITH regs AS (
    SELECT r.*
    FROM public.registrations r
    WHERE v_search = ''
       OR r.name ILIKE v_pattern
       OR r.badge_name ILIKE v_pattern
       OR r.cpf ILIKE v_cpf_pattern
       OR r.choir_name ILIKE v_pattern
       OR r.email ILIKE v_pattern
       OR r.phone ILIKE v_pattern
       OR r.city ILIKE v_pattern
       OR r.institution ILIKE v_pattern
  )
  SELECT jsonb_build_object(
    'registrations', coalesce((
      SELECT jsonb_agg(
        (to_jsonb(r) - ARRAY['checkout_url','order_nsu','infinitepay_invoice_slug','infinitepay_transaction_nsu','receipt_url','manual_paid_by','exempted_at','exempted_by'])
          || jsonb_build_object(
            'participant_accounts', coalesce((
              SELECT jsonb_agg(jsonb_build_object('access_status', pa.access_status))
              FROM public.participant_accounts pa WHERE pa.registration_id = r.id
            ), '[]'::jsonb),
            'regent_name', (
              SELECT cr.name FROM public.choir_regents cr
              WHERE cr.choir_id = r.choir_id AND cr.revoked_at IS NULL
              ORDER BY cr.granted_at DESC LIMIT 1
            ),
            'has_logged_in', EXISTS (
              SELECT 1 FROM public.participant_accounts pa
              JOIN auth.users u ON u.id = pa.user_id
              WHERE pa.registration_id = r.id AND u.last_sign_in_at IS NOT NULL
            )
          )
        ORDER BY r.created_at DESC, r.id DESC
      ) FROM regs r
    ), '[]'::jsonb),
    'complements', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'registration_id', c.registration_id, 'amount_cents', c.amount_cents,
        'status', c.status, 'checkout_url', c.checkout_url, 'created_at', c.created_at,
        'paid_at', c.paid_at, 'initiated_by_name', c.initiated_by_name, 'initiated_as', c.initiated_as
      ) ORDER BY c.created_at DESC, c.id DESC)
      FROM public.registration_complement_payments c
      JOIN regs r ON r.id = c.registration_id
      WHERE r.payment_status = 'paid' AND r.pricing_type = 'promotional'
    ), '[]'::jsonb),
    'reviews', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id, 'registration_id', s.registration_id, 'order_nsu', s.order_nsu,
        'amount_cents', s.amount_cents, 'paid_amount_cents', s.paid_amount_cents,
        'payment_method', s.payment_method, 'installments', s.installments, 'paid_at', s.paid_at,
        'infinitepay_transaction_nsu', s.infinitepay_transaction_nsu, 'receipt_url', s.receipt_url
      ) ORDER BY s.paid_at DESC, s.id DESC)
      FROM public.registration_superseded_checkouts s
      JOIN regs r ON r.id = s.registration_id
      WHERE s.status = 'paid_requires_review'
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_registration_snapshot(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_registration_snapshot(text) TO service_role;