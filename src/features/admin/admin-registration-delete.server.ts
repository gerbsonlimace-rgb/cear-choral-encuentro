import { supabaseAdmin } from "@/integrations/supabase/client.server";

type DeleteResult = {
  photo_path: string | null;
  manual_receipt_path: string | null;
  participant_user_id: string | null;
};

export async function deleteAdminRegistration(
  registrationId: string,
  adminUserId: string,
  cpf: string,
): Promise<{ status: "deleted" | "cpf_mismatch" }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin.rpc as any)("delete_admin_registration_confirmed", {
    p_registration_id: registrationId,
    p_admin_user_id: adminUserId,
    p_cpf: cpf,
  });
  if (error) {
    if (error.code === "22023") return { status: "cpf_mismatch" };
    console.error("[admin] delete registration failed", error);
    throw new Error("Não foi possível excluir a inscrição.");
  }
  const result = (data ?? {}) as DeleteResult;

  if (result.photo_path) {
    await supabaseAdmin.storage.from("registration-photos").remove([result.photo_path]);
  }
  if (result.manual_receipt_path) {
    await supabaseAdmin.storage
      .from("registration-payment-receipts")
      .remove([result.manual_receipt_path]);
  }
  if (result.participant_user_id) {
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
      result.participant_user_id,
    );
    if (authError) console.error("[admin] delete participant auth user failed", authError);
  }
  return { status: "deleted" };
}
