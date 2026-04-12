import { redirect } from "next/navigation";

import RegisterForm from "@/components/register-form";
import { getServerAuthSession } from "@/lib/auth";

export default async function RegisterPage() {
  const session = await getServerAuthSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return <RegisterForm />;
}
