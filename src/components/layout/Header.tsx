import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SentinelStackLogo } from "@/lib/icons";

export function Header() {
  return (
    <header className="px-4 lg:px-6 h-20 flex items-center bg-card/80 backdrop-blur-sm fixed top-0 left-0 right-0 z-50 border-b">
      <Link href="/" className="flex items-center justify-center">
        <SentinelStackLogo width={200} />
      </Link>
      <nav className="ml-auto flex gap-4 sm:gap-6 items-center">
        <Link
          href="#features"
          className="text-sm font-medium hover:underline underline-offset-4"
        >
          Features
        </Link>
        <Link
          href="#pricing"
          className="text-sm font-medium hover:underline underline-offset-4"
        >
          Pricing
        </Link>
        <Button asChild variant="outline">
          <Link href="/login">Login</Link>
        </Button>
        <Button asChild>
          <Link href="/signup">Sign Up</Link>
        </Button>
      </nav>
    </header>
  );
}
