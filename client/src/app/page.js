import Link from 'next/link';
import { Logo } from '@/components/Logo';

const features = [
  ['Live by default', 'Every move, edit and comment shows up for your team instantly over WebSockets.'],
  ['Drag and drop boards', 'Reorder cards and columns with keyboard or mouse. Changes save as you drop.'],
  ['See who is around', 'Presence avatars show who is on the board and which card they are looking at.'],
  ['Workspaces and roles', 'Invite teammates with a code. Owners and admins manage members and boards.'],
  ['Comments and activity', 'Discuss work on the card and follow a timeline of everything that changed.'],
  ['Filters that stick', 'Search, filter by assignee or priority, and see only what matters to you.'],
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/login" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Log in
          </Link>
          <Link href="/register" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Get started
          </Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Real time collaboration
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl">
            Your team&apos;s work, moving together.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            TeamFlow is a kanban task manager where every change syncs live. Plan sprints, assign work and keep everyone on the
            same board without refreshing.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/register" className="rounded-lg bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700">
              Create a free workspace
            </Link>
            <Link href="/login?demo=1" className="rounded-lg px-6 py-3 font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
              Try the demo account
            </Link>
          </div>
        </section>

        <section className="border-t border-slate-100 bg-slate-50">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-16 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {features.map(([title, body]) => (
              <div key={title} className="rounded-xl bg-white p-6 ring-1 ring-slate-200">
                <h2 className="font-semibold text-slate-900">{title}</h2>
                <p className="mt-2 text-sm text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-100 py-6 text-center text-sm text-slate-500">
        Built with Next.js, Redux Toolkit, Node.js, MongoDB and Socket.io.
      </footer>
    </div>
  );
}
