// src/services/emailService.ts
import nodemailer from "nodemailer";

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: "SMTP" | "RESEND" | "SENDGRID";
}

/**
 * Checks whether any real transactional email service is configured in the environment
 */
export function isEmailConfigured(): boolean {
  if (process.env.RESEND_API_KEY) return true;
  if (process.env.SENDGRID_API_KEY) return true;
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) return true;
  return false;
}

/**
 * Returns the name of the active email service provider
 */
export function getActiveEmailProvider(): string {
  if (process.env.RESEND_API_KEY) return "Resend API";
  if (process.env.SENDGRID_API_KEY) return "SendGrid API";
  if (process.env.SMTP_HOST) return `SMTP (${process.env.SMTP_HOST})`;
  return "None (Unconfigured)";
}

/**
 * Sends a real One-Time Password (OTP) email using the configured email service.
 * Never logs or exposes the OTP.
 */
export async function sendOtpEmail(
  toEmail: string,
  otp: string,
  portalName: string = "AICTE Complaint Portal"
): Promise<EmailSendResult> {
  const cleanEmail = toEmail.trim().toLowerCase();
  const fromAddress =
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    `"AICTE Complaint Portal" <no-reply@aicte-india.org>`;
  const subject = "AICTE Complaint Verification OTP";

  const textContent = `Dear User,

Your One-Time Password (OTP) for AICTE complaint verification is:

${otp}

This OTP is valid for 5 minutes.

Do not share this OTP with anyone.

Regards,
${portalName}
All India Council for Technical Education (AICTE)`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #0f172a; padding: 24px; text-align: center; border-bottom: 3px solid #f59e0b;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.5px;">ALL INDIA COUNCIL FOR TECHNICAL EDUCATION</h1>
        <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px;">${portalName}</p>
      </div>
      <div style="padding: 32px 24px; color: #1e293b;">
        <p style="font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;">Dear User,</p>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 20px 0; color: #334155;">
          Your One-Time Password (OTP) for AICTE complaint verification is:
        </p>
        <div style="background-color: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
          <span style="font-family: 'Courier New', Courier, monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #0f172a;">${otp}</span>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 16px 0 8px 0;">
          • This OTP is valid for <strong>5 minutes</strong>.<br>
          • Do not share this OTP with anyone.
        </p>
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
          Regards,<br>
          <strong style="color: #0f172a;">${portalName}</strong><br>
          Nelson Mandela Marg, Vasant Kunj, New Delhi-110070
        </div>
      </div>
    </div>
  `;

  // 1. Try Resend REST API if configured
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: fromAddress,
          to: cleanEmail,
          subject,
          text: textContent,
          html: htmlContent,
        }),
      });

      const resData: any = await response.json();
      if (!response.ok) {
        console.error("[EmailService] Resend API error:", resData?.message || response.statusText);
        return {
          success: false,
          error: resData?.message || "Resend email delivery failed",
          provider: "RESEND",
        };
      }
      return { success: true, messageId: resData?.id, provider: "RESEND" };
    } catch (err: any) {
      console.error("[EmailService] Resend network error:", err.message);
      return { success: false, error: err.message, provider: "RESEND" };
    }
  }

  // 2. Try SendGrid REST API if configured
  if (process.env.SENDGRID_API_KEY) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: cleanEmail }] }],
          from: {
            email: fromAddress.includes("<")
              ? fromAddress.match(/<([^>]+)>/)?.[1] || fromAddress
              : fromAddress,
          },
          subject,
          content: [
            { type: "text/plain", value: textContent },
            { type: "text/html", value: htmlContent },
          ],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[EmailService] SendGrid error:", errText);
        return { success: false, error: "SendGrid email delivery failed", provider: "SENDGRID" };
      }
      return { success: true, provider: "SENDGRID" };
    } catch (err: any) {
      console.error("[EmailService] SendGrid network error:", err.message);
      return { success: false, error: err.message, provider: "SENDGRID" };
    }
  }

  // 3. Try SMTP with Nodemailer if configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const port = parseInt(process.env.SMTP_PORT || "587", 10);
      const secure = process.env.SMTP_SECURE === "true" || port === 465;

      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === "production",
        },
      });

      const info = await transporter.sendMail({
        from: fromAddress,
        to: cleanEmail,
        subject,
        text: textContent,
        html: htmlContent,
      });

      return { success: true, messageId: info.messageId, provider: "SMTP" };
    } catch (err: any) {
      console.error("[EmailService] SMTP delivery error:", err.message);
      return { success: false, error: err.message, provider: "SMTP" };
    }
  }

  // 4. No email service configured
  return {
    success: false,
    error: "EMAIL_SERVICE_NOT_CONFIGURED",
  };
}

/**
 * Sends a formal FDR Maturity Reminder email to an institution if email is configured.
 */
export async function sendMaturityReminderEmail(params: {
  toEmail: string;
  institutionName: string;
  collegeId: string;
  fdrNumber: string;
  amount: number;
  maturityDate: Date;
  daysRemaining: number;
  letterContent: string;
}): Promise<EmailSendResult> {
  const { toEmail, institutionName, collegeId, fdrNumber, amount, maturityDate, daysRemaining, letterContent } = params;

  if (!isEmailConfigured()) {
    return {
      success: false,
      error: "EMAIL_SERVICE_NOT_CONFIGURED",
    };
  }

  const cleanEmail = toEmail.trim().toLowerCase();
  const fromAddress =
    process.env.EMAIL_FROM ||
    process.env.SMTP_FROM ||
    `"AICTE Finance Bureau" <finance-fdr@aicte-india.org>`;
  const subject = `AICTE Formal Reminder: FDR Maturity Due in ${daysRemaining} Days (Ref: ${fdrNumber})`;

  const textContent = `ALL INDIA COUNCIL FOR TECHNICAL EDUCATION
Finance Bureau & Fixed Deposit Division
Nelson Mandela Marg, Vasant Kunj, New Delhi - 110070

To,
The Head of Institution,
${institutionName} (${collegeId})

SUBJECT: URGENT NOTICE - MATURITY OF SECURITY DEPOSIT FDR (Ref: ${fdrNumber})

Dear Sir/Madam,

This is an official communication regarding your institution's Security Deposit / Joint Fixed Deposit Receipt (FDR) held under Council lien:

• Institution: ${institutionName}
• College ID: ${collegeId}
• FDR Reference Number: ${fdrNumber}
• Principal Amount: ₹${new Intl.NumberFormat("en-IN").format(amount || 0)}
• Maturity Date: ${new Date(maturityDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
• Days Remaining: ${daysRemaining} Days

Please review the formal instructions recorded below and take necessary action via the AICTE Unified Portal.

${letterContent}

Regards,
Member Secretary / Finance Officer
All India Council for Technical Education (AICTE)`;

  const htmlContent = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
      <div style="background-color: #0f172a; padding: 24px; text-align: center; border-bottom: 4px solid #f59e0b;">
        <h1 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 800; letter-spacing: 0.5px;">ALL INDIA COUNCIL FOR TECHNICAL EDUCATION</h1>
        <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px;">Finance Bureau & Fixed Deposit (FDR) Division</p>
      </div>
      <div style="padding: 28px 24px; color: #1e293b;">
        <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 14px 18px; margin-bottom: 20px;">
          <strong style="color: #92400e; font-size: 14px;">⚠️ URGENT REGULATORY NOTICE: FDR MATURITY IN ${daysRemaining} DAYS</strong>
        </div>
        <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">To,<br>The Head of Institution / Principal,<br><strong>${institutionName}</strong> (${collegeId})</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">FDR Reference:</td><td style="padding: 8px 0; font-weight: 700; color: #0f172a;">${fdrNumber}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Maturity Date:</td><td style="padding: 8px 0; font-weight: 700; color: #b45309;">${new Date(maturityDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Days Remaining:</td><td style="padding: 8px 0; font-weight: 700; color: #b45309;">${daysRemaining} Days</td></tr>
          <tr style="border-bottom: 1px solid #e2e8f0;"><td style="padding: 8px 0; color: #64748b;">Principal Deposit:</td><td style="padding: 8px 0; font-weight: 700; color: #0f172a;">₹${new Intl.NumberFormat("en-IN").format(amount || 0)}</td></tr>
        </table>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 20px 0; font-family: monospace; font-size: 12px; white-space: pre-wrap; color: #334155;">${letterContent}</div>
        <p style="font-size: 13px; color: #475569; line-height: 1.5;">Please log in to the <strong>AICTE Unified Portal</strong> at <a href="http://localhost:3000/institution/dashboard">Institution Portal</a> to review your Deposit Details and submit a Release Application if eligible.</p>
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">
          Finance Bureau<br>All India Council for Technical Education (AICTE)<br>Nelson Mandela Marg, Vasant Kunj, New Delhi-110070
        </div>
      </div>
    </div>
  `;

  // 1. Resend
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({ from: fromAddress, to: cleanEmail, subject, text: textContent, html: htmlContent }),
      });
      const resData: any = await response.json();
      if (!response.ok) return { success: false, error: resData?.message || "Resend failed", provider: "RESEND" };
      return { success: true, messageId: resData?.id, provider: "RESEND" };
    } catch (err: any) {
      return { success: false, error: err.message, provider: "RESEND" };
    }
  }

  // 2. SendGrid
  if (process.env.SENDGRID_API_KEY) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.SENDGRID_API_KEY}` },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: cleanEmail }] }],
          from: { email: fromAddress.includes("<") ? fromAddress.match(/<([^>]+)>/)?.[1] || fromAddress : fromAddress },
          subject,
          content: [{ type: "text/plain", value: textContent }, { type: "text/html", value: htmlContent }],
        }),
      });
      if (!response.ok) return { success: false, error: "SendGrid delivery failed", provider: "SENDGRID" };
      return { success: true, provider: "SENDGRID" };
    } catch (err: any) {
      return { success: false, error: err.message, provider: "SENDGRID" };
    }
  }

  // 3. SMTP
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const port = parseInt(process.env.SMTP_PORT || "587", 10);
      const secure = process.env.SMTP_SECURE === "true" || port === 465;
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
        tls: { rejectUnauthorized: process.env.NODE_ENV === "production" },
      });
      const info = await transporter.sendMail({ from: fromAddress, to: cleanEmail, subject, text: textContent, html: htmlContent });
      return { success: true, messageId: info.messageId, provider: "SMTP" };
    } catch (err: any) {
      return { success: false, error: err.message, provider: "SMTP" };
    }
  }

  return { success: false, error: "EMAIL_SERVICE_NOT_CONFIGURED" };
}
