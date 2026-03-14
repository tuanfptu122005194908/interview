import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const accounts = [
    { email: "interviewer1@interview.os", password: "interview123", role: "interviewer_1" },
    { email: "interviewer2@interview.os", password: "interview123", role: "interviewer_2" },
    { email: "interviewer3@interview.os", password: "interview123", role: "interviewer_3" },
    { email: "viewer@interview.os", password: "interview123", role: "viewer" },
  ];

  const results = [];

  for (const account of accounts) {
    // Check if user exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: any) => u.email === account.email);

    let userId: string;

    if (existing) {
      userId = existing.id;
      results.push({ email: account.email, status: "already exists", role: account.role });
    } else {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true,
      });

      if (error) {
        results.push({ email: account.email, status: "error", error: error.message });
        continue;
      }
      userId = data.user.id;
      results.push({ email: account.email, status: "created", role: account.role });
    }

    // Upsert role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: account.role }, { onConflict: "user_id,role" });

    if (roleError) {
      results.push({ email: account.email, roleError: roleError.message });
    }
  }

  return new Response(JSON.stringify({ results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
