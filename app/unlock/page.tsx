import { UnlockForm } from "./unlock-form";

export const dynamic = "force-dynamic";

/** 돌아갈 경로는 내부 경로만 허용한다 (열린 리다이렉트 방지) */
function safeNext(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function UnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <UnlockForm next={safeNext(next)} />;
}
