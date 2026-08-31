import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

async function validateInitData(initData: string, botToken: string): Promise<boolean> {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return false;

  const authDate = Number(params.get("auth_date") ?? "0");
  if (!authDate || Date.now() / 1000 - authDate > 86_400) return false;

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = await hmacSha256(new TextEncoder().encode(botToken), "WebAppData");
  const signature = await hmacSha256(secretKey, dataCheckString);
  return toHex(signature) === hash;
}

async function validateWidgetAuth(user: TelegramWidgetUser, botToken: string): Promise<boolean> {
  const { hash, ...rest } = user;
  const dataCheckString = Object.entries(rest)
    .filter(([, v]) => v !== undefined && v !== null)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(botToken));
  const signature = await hmacSha256(secretKey, dataCheckString);
  return toHex(signature) === hash;
}

function parseTelegramUser(initData: string): TelegramWidgetUser | null {
  const params = new URLSearchParams(initData);
  const raw = params.get("user");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TelegramWidgetUser;
    return parsed?.id ? parsed : null;
  } catch {
    return null;
  }
}

function syntheticEmail(telegramId: number): string {
  return `tg_${telegramId}@telegram.veilo.app`;
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

    const body = await req.json() as { initData?: string; widgetUser?: TelegramWidgetUser };
    let tgUser: TelegramWidgetUser | null = null;

    if (body.initData) {
      const valid = await validateInitData(body.initData, botToken);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid Telegram initData" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      tgUser = parseTelegramUser(body.initData);
    } else if (body.widgetUser) {
      const valid = await validateWidgetAuth(body.widgetUser, botToken);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid Telegram widget auth" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      tgUser = body.widgetUser;
    }

    if (!tgUser?.id) {
      return new Response(JSON.stringify({ error: "Telegram user not found" }), {
        status: 400,
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

    const { data: existingProfile } = await admin
      .from("profiles")
      .select("id")
      .eq("telegram_id", tgUser.id)
      .maybeSingle();

    let userId = existingProfile?.id as string | undefined;

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: metadata,
      });

      if (createError) {
        const { data: listed } = await admin.auth.admin.listUsers();
        const match = listed.users.find(
          (u) =>
            u.email === email ||
            u.user_metadata?.telegram_id === tgUser.id,
        );
        userId = match?.id;
        if (!userId) throw createError;
      } else {
        userId = created.user.id;
      }
    }

    const { data: sessionData, error: sessionError } = await admin.auth.admin.createSession({
      user_id: userId,
    });
    if (sessionError || !sessionData.session) throw sessionError ?? new Error("Session creation failed");

    return new Response(
      JSON.stringify({
        access_token: sessionData.session.access_token,
        refresh_token: sessionData.session.refresh_token,
        expires_in: sessionData.session.expires_in,
        user: sessionData.session.user,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
