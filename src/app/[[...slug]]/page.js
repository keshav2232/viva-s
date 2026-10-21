import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import { matchRoute } from "@/app/routes";

/**
 * Every practice-app address (/, /login, /dashboard, /practice/new, /practice/session,
 * /reports/<id>) is served here. Unknown addresses get the 404 page; each known one gets its own
 * title. Inside the app, screens change with history.pushState (see AppShell), so state such as an
 * active viva survives moving between them.
 */
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const route = matchRoute(slug || []);
  if (!route) return {};
  // The page <title> is rendered by AppShell so it follows in-app navigation and redirects.
  const meta = {};
  // Private screens should never show up in search results.
  if (!["landing", "login", "signup"].includes(route.name)) meta.robots = { index: false, follow: false };
  return meta;
}

export default async function AppPage({ params }) {
  const { slug } = await params;
  if (!matchRoute(slug || [])) notFound();
  return <AppShell />;
}
