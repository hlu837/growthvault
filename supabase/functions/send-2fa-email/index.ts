import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface TwoFactorPayload {
  record: {
    id: string;
    user_id: string;
    code: string;
    type: string;
    created_at: string;
    expires_at: string;
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: TwoFactorPayload = await req.json();
    const { record } = payload;

    // Get user email from auth.users table
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
    );

    const { data: userData, error: userError } = await supabase
      .from("auth.users")
      .select("email")
      .eq("id", record.user_id)
      .single();

    if (userError || !userData) {
      console.error("Error fetching user:", userError);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = userData.email;

    // Determine email subject and template based on code type
    let subject = "";
    let htmlBody = "";

    if (record.type === "login") {
      subject = "Your Two-Factor Authentication Code";
      htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .code { font-size: 36px; font-weight: bold; color: #007bff; letter-spacing: 2px; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 20px 0; }
            .footer { color: #666; font-size: 12px; text-align: center; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Two-Factor Authentication Code</h2>
            <p>Your login requires two-factor authentication. Use the code below to complete your sign-in:</p>
            <div class="code">${record.code}</div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email or contact support immediately.</p>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else if (record.type === "withdrawal") {
      subject = "Your Withdrawal Verification Code";
      htmlBody = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .code { font-size: 36px; font-weight: bold; color: #28a745; letter-spacing: 2px; text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; margin: 20px 0; }
            .footer { color: #666; font-size: 12px; text-align: center; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>Withdrawal Verification Code</h2>
            <p>A withdrawal request requires verification. Use the code below to confirm:</p>
            <div class="code">${record.code}</div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this withdrawal, please contact support immediately.</p>
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `;
    }

    // Try to send via Resend first, fall back to console in development
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendApiKey) {
      // Send via Resend
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "noreply@growthvault.com",
          to: userEmail,
          subject,
          html: htmlBody,
        }),
      });

      if (!resendResponse.ok) {
        const error = await resendResponse.text();
        console.error("Resend error:", error);
        return new Response(
          JSON.stringify({ error: "Failed to send email" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: "Email sent successfully" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Development mode: log email to console
      console.log(`📧 [DEV MODE] Email would be sent to ${userEmail}`);
      console.log(`Subject: ${subject}`);
      console.log(`Code: ${record.code}`);
      console.log("---");
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Development mode: Check console for email details",
          email: userEmail,
          code: record.code
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
