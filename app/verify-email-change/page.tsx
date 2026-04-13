import VerifyEmailChangeView from "@/components/verify-email-change-view";

type VerifyEmailChangePageProps = {
  searchParams?: {
    token?: string;
  };
};

export default function VerifyEmailChangePage({ searchParams }: VerifyEmailChangePageProps) {
  return <VerifyEmailChangeView token={searchParams?.token} />;
}
