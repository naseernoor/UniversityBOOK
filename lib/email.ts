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
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM
  );

const getTransporter = () => {
  if (!canSendEmail()) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
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
      <h2>Verify your UniversityBOOK account</h2>
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

  const text = `Verify your UniversityBOOK account by visiting: ${verifyUrl}`;

  const transporter = getTransporter();
  if (!transporter) {
    console.warn("SMTP is not configured. Verification email link:", verifyUrl);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: params.toEmail,
    subject: "Verify your UniversityBOOK account",
    text,
    html
  });
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
      <h2>Reset your UniversityBOOK password</h2>
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
    console.warn("SMTP is not configured. Password reset link:", resetUrl);
    return;
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: params.toEmail,
    subject: "Reset your UniversityBOOK password",
    text,
    html
  });
};
