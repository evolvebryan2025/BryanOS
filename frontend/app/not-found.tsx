import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="text-center">
        <p className="text-7xl font-bold text-gradient-red">404</p>
        <h1 className="mt-4 font-[family-name:var(--font-syne)] text-2xl font-bold text-foreground">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-brand-red px-6 text-sm font-medium text-white hover:bg-brand-red-dark transition-colors glow-red-hover"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
