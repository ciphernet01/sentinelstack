import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SentinelStackLogo } from "@/lib/icons";
import { Shield } from "lucide-react";

export function Header() {
  return (
    <header className="px-4 lg:px-6 h-20 flex items-center bg-slate-950/80 backdrop-blur-md fixed top-0 left-0 right-0 z-50 border-b border-slate-800">
      <Link href="/" className="flex items-center gap-2 justify-center">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <span className="text-xl font-bold text-white">SentinelStack</span>
      </Link>
      <nav className="ml-auto flex gap-2 sm:gap-6 items-center">
        <Link
          href="#features"
          className="text-sm font-medium text-slate-400 hover:text-white transition-colors hidden sm:block"
        >
          Features
        </Link>
        <Link
          href="#pricing"
          className="text-sm font-medium text-slate-400 hover:text-white transition-colors hidden sm:block"
        >
          Pricing
        </Link>
        <Link
          href="/pricing"
          className="text-sm font-medium text-slate-400 hover:text-white transition-colors hidden sm:block"
        >
          Plans
        </Link>
        <Button asChild variant="ghost" className="text-slate-300 hover:text-white hover:bg-slate-800">
          <Link href="/login">Login</Link>
        </Button>
        <Button asChild className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0">
          <Link href="/signup">Start Free</Link>
        </Button>
      </nav>
    </header>
  );
}
