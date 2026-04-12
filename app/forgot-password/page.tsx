import ForgotPasswordForm from "@/components/forgot-password-form";

type ForgotPasswordPageProps = {
  searchParams?: {
    email?: string;
  };
};

export default function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const initialEmail = searchParams?.email ?? "";
  return <ForgotPasswordForm initialEmail={initialEmail} />;
}
