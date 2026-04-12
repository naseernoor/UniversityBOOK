import { redirect } from "next/navigation";

import LoginForm from "@/components/login-form";
import { getServerAuthSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getServerAuthSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return <LoginForm />;
}
