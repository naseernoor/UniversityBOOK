import nodemailer from "nodemailer";

const getAppUrl = () => {
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
};

const canSendEmail = () =>
  Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS
  );

const getTransporter = () => {
  if (!canSendEmail()) {
    return null;
  }

  const smtpPort = Number(process.env.SMTP_PORT);
  const smtpSecureRaw = process.env.SMTP_SECURE;
  const smtpSecure =
    typeof smtpSecureRaw === "string" && smtpSecureRaw.length > 0
      ? smtpSecureRaw.toLowerCase() === "true"
      : smtpPort === 465;

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

const logFallbackLink = (type: "verification" | "password reset", url: string) => {
  if (process.env.NODE_ENV === "production") {
    console.warn(`${type} email link generated but SMTP delivery failed`);
    return;
  }
  console.warn(`Fallback ${type} link:`, url);
};

const logFallbackCode = (type: "2fa", code: string) => {
  if (process.env.NODE_ENV === "production") {
    console.warn(`${type} code generated but delivery failed`);
    return;
  }
  console.warn(`Fallback ${type} code:`, code);
};

export const sendVerificationEmail = async (params: {
  toEmail: string;
  firstName?: string | null;
  token: string;
}) => {
  const appUrl = getAppUrl();
  const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(params.token)}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; line-height: 1.6;">
      <h2>Verify your UniBOOK account</h2>
      <p>Hi ${params.firstName ?? "there"},</p>
      <p>Click the button below to verify your email and activate your account.</p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl}" style="background:#1f6f5c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Verify Email</a>
      </p>
      <p>If the button does not work, use this link:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in 24 hours.</p>
    </div>
  `;

  const text = `Verify your UniBOOK account by visiting: ${verifyUrl}`;

  const transporter = getTransporter();
  if (!transporter) {
    logFallbackLink("verification", verifyUrl);
    return false;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;

  try {
    await transporter.sendMail({
      from,
      to: params.toEmail,
      subject: "Verify your UniBOOK account",
      text,
      html
    });
    return true;
  } catch (error) {
    console.error("Failed to send verification email:", error);
    logFallbackLink("verification", verifyUrl);
    return false;
  }
};

export const sendPasswordResetEmail = async (params: {
  toEmail: string;
  firstName?: string | null;
  token: string;
}) => {
  const appUrl = getAppUrl();
  const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(params.token)}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; line-height: 1.6;">
      <h2>Reset your UniBOOK password</h2>
      <p>Hi ${params.firstName ?? "there"},</p>
      <p>You requested a password reset. Click below to choose a new password.</p>
      <p style="margin: 24px 0;">
        <a href="${resetUrl}" style="background:#1f6f5c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Reset Password</a>
      </p>
      <p>If the button does not work, use this link:</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in 1 hour.</p>
    </div>
  `;

  const text = `Reset your password by visiting: ${resetUrl}`;

  const transporter = getTransporter();
  if (!transporter) {
    logFallbackLink("password reset", resetUrl);
    return false;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;

  try {
    await transporter.sendMail({
      from,
      to: params.toEmail,
      subject: "Reset your UniBOOK password",
      text,
      html
    });
    return true;
  } catch (error) {
    console.error("Failed to send password reset email:", error);
    logFallbackLink("password reset", resetUrl);
    return false;
  }
};

export const sendEmailChangeVerificationEmail = async (params: {
  toEmail: string;
  firstName?: string | null;
  token: string;
}) => {
  const appUrl = getAppUrl();
  const verifyUrl = `${appUrl}/verify-email-change?token=${encodeURIComponent(params.token)}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; line-height: 1.6;">
      <h2>Confirm your new UniBOOK email</h2>
      <p>Hi ${params.firstName ?? "there"},</p>
      <p>Click below to verify this new email address for your account.</p>
      <p style="margin: 24px 0;">
        <a href="${verifyUrl}" style="background:#1f6f5c;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;display:inline-block;">Verify New Email</a>
      </p>
      <p>If the button does not work, use this link:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link expires in 24 hours.</p>
    </div>
  `;

  const text = `Verify your new UniBOOK email by visiting: ${verifyUrl}`;
  const transporter = getTransporter();
  if (!transporter) {
    logFallbackLink("verification", verifyUrl);
    return false;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;

  try {
    await transporter.sendMail({
      from,
      to: params.toEmail,
      subject: "Verify your new UniBOOK email",
      text,
      html
    });
    return true;
  } catch (error) {
    console.error("Failed to send email-change verification email:", error);
    logFallbackLink("verification", verifyUrl);
    return false;
  }
};

const sendSms = async (params: { toPhone: string; message: string }) => {
  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN ||
    !process.env.TWILIO_FROM_PHONE
  ) {
    return false;
  }

  try {
    const twilioModule = await import("twilio");
    const client = twilioModule.default(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    await client.messages.create({
      from: process.env.TWILIO_FROM_PHONE,
      to: params.toPhone,
      body: params.message
    });
    return true;
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return false;
  }
};

export const sendTwoFactorCode = async (params: {
  method: "EMAIL" | "PHONE";
  code: string;
  toEmail?: string | null;
  toPhone?: string | null;
  firstName?: string | null;
}) => {
  const message = `Your UniBOOK security code is ${params.code}. It expires in 10 minutes.`;

  if (params.method === "PHONE" && params.toPhone) {
    const sentSms = await sendSms({
      toPhone: params.toPhone,
      message
    });

    if (sentSms) {
      return true;
    }
  }

  if (!params.toEmail) {
    logFallbackCode("2fa", params.code);
    return false;
  }

  const transporter = getTransporter();
  if (!transporter) {
    logFallbackCode("2fa", params.code);
    return false;
  }

  const from = process.env.SMTP_FROM ?? process.env.SMTP_USER;

  try {
    await transporter.sendMail({
      from,
      to: params.toEmail,
      subject: "Your UniBOOK security code",
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; line-height: 1.6;">
          <h2>Two-factor authentication code</h2>
          <p>Hi ${params.firstName ?? "there"},</p>
          <p>Use this code to continue login:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:20px 0;">${params.code}</p>
          <p>This code expires in 10 minutes.</p>
        </div>
      `
    });
    return true;
  } catch (error) {
    console.error("Failed to send 2FA email:", error);
    logFallbackCode("2fa", params.code);
    return false;
  }
};
