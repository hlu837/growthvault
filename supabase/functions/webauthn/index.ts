import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "https://esm.sh/@simplewebauthn/server@5.3.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const bufferFromBase64Url = (base64url: string): ArrayBuffer => {
  const padding = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + padding;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const base64UrlFromArrayBuffer = (buffer: ArrayBuffer | Uint8Array): string => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const arrayBufferFromBase64 = (base64: string): ArrayBuffer => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
};

const normalizeRpId = (host: string | null) => {
  if (!host) {
    throw new Error("Missing host header");
  }
  return host.split(":")[0];
};

const getAuthUser = async (supabase: any, req: Request) => {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
};

const getUserFromRequest = async (req: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  return await getAuthUser(supabase, req);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const user = await getAuthUser(supabase, req);
    if (!user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const url = new URL(req.url);
    const rpID = normalizeRpId(req.headers.get("host"));
    const origin = req.headers.get("origin") || `https://${rpID}`;
    const path = url.pathname.replace(/\/function(s)?\/v1\/webauthn/, "").replace(/\/$/, "");
    const method = req.method.toUpperCase();

    if (path === "/register/options" && method === "GET") {
      const { data: existing } = await supabase
        .from("webauthn_credentials")
        .select("credential_id")
        .eq("user_id", user.id);

      const options = generateRegistrationOptions({
        rpName: "Golden Wealth Achievers",
        rpID,
        userID: user.id,
        userName: user.email || user.id,
        attestationType: "none",
        authenticatorSelection: {
          userVerification: "preferred",
        },
        excludeCredentials: (existing || []).map((credential: any) => ({
          id: credential.credential_id,
          type: "public-key",
        })),
      });

      await supabase.from("webauthn_challenges").insert({
        user_id: user.id,
        challenge: options.challenge,
        type: "registration",
      });

      return json(options);
    }

    if (path === "/register/verify" && method === "POST") {
      const body = await req.json();
      const { credential } = body;
      if (!credential) {
        return json({ error: "Missing credential" }, 400);
      }

      const { data: challengeRows, error: challengeError } = await supabase
        .from("webauthn_challenges")
        .select("id, challenge")
        .eq("user_id", user.id)
        .eq("type", "registration")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (challengeError || !challengeRows) {
        return json({ error: "Registration challenge not found" }, 400);
      }

      const verification = await verifyRegistrationResponse({
        credential: {
          id: credential.id,
          rawId: bufferFromBase64Url(credential.rawId),
          response: {
            clientDataJSON: bufferFromBase64Url(credential.response.clientDataJSON),
            attestationObject: bufferFromBase64Url(credential.response.attestationObject),
          },
          type: credential.type,
        },
        expectedChallenge: challengeRows.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return json({ error: "Passkey registration failed" }, 400);
      }

      const { credentialPublicKey, credentialID, counter, fmt } = verification.registrationInfo;
      await supabase.from("webauthn_credentials").insert({
        user_id: user.id,
        credential_id: base64UrlFromArrayBuffer(credentialID),
        public_key: base64UrlFromArrayBuffer(credentialPublicKey),
        sign_count: counter,
        transports: [],
      });

      await supabase.from("webauthn_challenges").delete().eq("id", challengeRows.id);
      return json({ verified: true });
    }

    if (path === "/auth/options" && method === "GET") {
      const { data: existing } = await supabase
        .from("webauthn_credentials")
        .select("credential_id")
        .eq("user_id", user.id);

      const allowCredentials = (existing || []).map((credential: any) => ({
        id: credential.credential_id,
        type: "public-key",
        transports: ["internal"],
      }));

      const options = generateAuthenticationOptions({
        timeout: 60000,
        rpID,
        allowCredentials,
        userVerification: "preferred",
      });

      await supabase.from("webauthn_challenges").insert({
        user_id: user.id,
        challenge: options.challenge,
        type: "authentication",
      });

      return json(options);
    }

    if (path === "/auth/verify" && method === "POST") {
      const body = await req.json();
      const { assertion } = body;
      if (!assertion) {
        return json({ error: "Missing assertion" }, 400);
      }

      const { data: challengeRows, error: challengeError } = await supabase
        .from("webauthn_challenges")
        .select("id, challenge")
        .eq("user_id", user.id)
        .eq("type", "authentication")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (challengeError || !challengeRows) {
        return json({ error: "Authentication challenge not found" }, 400);
      }

      const { data: credentialRows, error: credentialError } = await supabase
        .from("webauthn_credentials")
        .select("id, credential_id, public_key, sign_count")
        .eq("user_id", user.id)
        .eq("credential_id", assertion.id)
        .maybeSingle();

      if (credentialError || !credentialRows) {
        return json({ error: "WebAuthn credential not found" }, 400);
      }

      const verification = await verifyAuthenticationResponse({
        credential: {
          id: assertion.id,
          rawId: bufferFromBase64Url(assertion.rawId),
          response: {
            clientDataJSON: bufferFromBase64Url(assertion.response.clientDataJSON),
            authenticatorData: bufferFromBase64Url(assertion.response.authenticatorData),
            signature: bufferFromBase64Url(assertion.response.signature),
            userHandle: assertion.response.userHandle ? bufferFromBase64Url(assertion.response.userHandle) : null,
          },
          type: assertion.type,
        },
        expectedChallenge: challengeRows.challenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        authenticator: {
          credentialID: bufferFromBase64Url(credentialRows.credential_id),
          credentialPublicKey: arrayBufferFromBase64(credentialRows.public_key),
          counter: Number(credentialRows.sign_count),
        },
      });

      if (!verification.verified) {
        return json({ error: "Passkey authentication failed" }, 400);
      }

      await supabase
        .from("webauthn_credentials")
        .update({ sign_count: verification.authenticationInfo.newSignCount })
        .eq("id", credentialRows.id);
      await supabase.from("webauthn_challenges").delete().eq("id", challengeRows.id);
      return json({ verified: true });
    }

    return json({ error: "Not found" }, 404);
  } catch (error: any) {
    return json({ error: error?.message || "Unexpected error" }, 500);
  }
});
