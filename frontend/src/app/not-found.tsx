import Link from "next/link";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="text-center">
        <p className="text-3xl font-extrabold text-primary-500">404</p>
        <p className="mt-2 text-sm font-semibold">Page not found</p>
        <Link href="/" className="mt-3 inline-block text-xs font-semibold text-primary-600 underline">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}