import { LandingPage } from "@/components/landing-page";
import { createPublicPageMetadata } from "@/lib/seo";
import "./landing.css";

export const metadata = createPublicPageMetadata(
  "Discover and build open-source projects",
  "Explore open-source projects, developer tools, and experiments on CodeBloom. Read project stories, browse topics, and find your next idea to build.",
  "/",
);

export default function HomePage() {
  return <LandingPage />;
}
