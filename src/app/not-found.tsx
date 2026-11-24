import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="app-main"
      className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="max-w-md text-muted-foreground">
        That page doesn't exist or has moved. Head back to the app or the home
        page.
      </p>
      <div className="flex gap-3">
        <Link
          href="/app"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
        >
          Open the app
        </Link>
        <Link href="/" className="rounded-md border px-4 py-2 text-sm">
          Home
        </Link>
      </div>
    </main>
  );
}
