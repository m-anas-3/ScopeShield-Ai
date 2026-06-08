import { AuthForm } from "@/components/shared/AuthForm";

interface LoginPageProps {
  searchParams?: {
    next?: string;
  };
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const nextPath =
    searchParams?.next && searchParams.next.startsWith("/")
      ? searchParams.next
      : "/dashboard";

  return <AuthForm mode="login" nextPath={nextPath} />;
}
