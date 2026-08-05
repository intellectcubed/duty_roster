import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col items-start gap-4 p-16">
      <h1 className="text-3xl font-semibold">EMS Duty Roster</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Generate and manage the EMS duty roster.
      </p>
      <Link
        href="/roster"
        className="rounded-full bg-foreground px-5 py-3 text-background"
      >
        View roster
      </Link>
    </main>
  );
}
