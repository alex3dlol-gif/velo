import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type TelegramWidgetUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

async function hmacSha256(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function validateWidgetAuth(user: TelegramWidgetUser, botToken: string): Promise<boolean> {
  const { hash } = user;
  const fields: Record<string, string> = {
    id: String(user.id),
    first_name: user.first_name,
    auth_date: String(user.auth_date),
  };
  if (user.last_name) fields.last_name = user.last_name;
  if (user.username) fields.username = user.username;
  if (user.photo_url) fields.photo_url = user.photo_url;

  const dataCheckString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(botToken));
  const signature = await hmacSha256(secretKey, dataCheckString);
  return toHex(signature) === hash;
}

function syntheticEmail(telegramId: number): string {
  return `tg_${telegramId}@telegram.veilo.app`;
}

async function findUserIdByTelegramId(
  admin: SupabaseClient,
  telegramId: number,
  email: string,
): Promise<string | undefined> {
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (profile?.id) return profile.id as string;

  for (let page = 1; page <= 5; page++) {
    const { data: listed, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = listed.users.find(
      (u) => u.email === email || u.user_metadata?.telegram_id === telegramId,
    );
    if (match) return match.id;
    if (listed.users.length < 200) break;
  }

  return undefined;
}

async function issueSession(admin: SupabaseClient, email: string) {
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkError) throw linkError;

  const tokenHash = linkData?.properties?.hashed_token;
  if (!tokenHash) throw new Error("Failed to generate auth token");

  const { data: verified, error: verifyError } = await admin.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });

  if (verifyError) throw verifyError;
  if (!verified.session) throw new Error("Session was not created");

  return verified.session;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!botToken || !supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server auth is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as { widgetUser?: Record<string, unknown> };
    if (!body.widgetUser) {
      return new Response(JSON.stringify({ error: "widgetUser is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = body.widgetUser;
    const tgUser: TelegramWidgetUser = {
      id: Number(raw.id),
      first_name: String(raw.first_name ?? ""),
      auth_date: Number(raw.auth_date),
      hash: String(raw.hash ?? ""),
      last_name: raw.last_name ? String(raw.last_name) : undefined,
      username: raw.username ? String(raw.username) : undefined,
      photo_url: raw.photo_url ? String(raw.photo_url) : undefined,
    };

    if (!tgUser.id || !tgUser.hash || !tgUser.first_name) {
      return new Response(JSON.stringify({ error: "Invalid Telegram user payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const valid = await validateWidgetAuth(tgUser, botToken);
    if (!valid) {
      return new Response(JSON.stringify({ error: "Invalid Telegram widget auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const email = syntheticEmail(tgUser.id);
    const metadata = {
      telegram_id: tgUser.id,
      user_name: tgUser.username ?? tgUser.first_name,
      username: tgUser.username ?? tgUser.first_name,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name,
      avatar_url: tgUser.photo_url,
      photo_url: tgUser.photo_url,
    };

    let userId = await findUserIdByTelegramId(admin, tgUser.id, email);

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (createError) {
        userId = await findUserIdByTelegramId(admin, tgUser.id, email);
        if (!userId) throw createError;
      } else {
        userId = created.user.id;
      }
    } else {
      await admin.auth.admin.updateUserById(userId, { user_metadata: metadata });
      await admin
        .from("profiles")
        .update({
          username: metadata.username,
          photo_url: metadata.photo_url,
          telegram_id: tgUser.id,
        })
        .eq("id", userId);
    }

    const session = await issueSession(admin, email);

    return new Response(
      JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        user: session.user,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[telegram-auth]", message, error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
