import VerifyEmailView from "@/components/verify-email-view";

type VerifyEmailPageProps = {
  searchParams?: {
    token?: string;
  };
};

export default function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  return <VerifyEmailView token={searchParams?.token} />;
}
