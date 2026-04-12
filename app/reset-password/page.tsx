import ResetPasswordForm from "@/components/reset-password-form";

type ResetPasswordPageProps = {
  searchParams?: {
    token?: string;
  };
};

export default function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  return <ResetPasswordForm token={searchParams?.token} />;
}
