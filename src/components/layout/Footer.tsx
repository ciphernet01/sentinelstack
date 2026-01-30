import Link from "next/link";
import { Shield, Github, Twitter, Linkedin } from "lucide-react";

export function Footer() {
    return (
        <footer className="bg-slate-950 border-t border-slate-800">
          <div className="container px-4 md:px-6 py-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {/* Brand */}
              <div className="col-span-2 md:col-span-1">
                <Link href="/" className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-lg font-bold text-white">SentinelStack</span>
                </Link>
                <p className="text-sm text-slate-400 mb-4">
                  AI-powered security assessment platform for modern teams.
                </p>
                <div className="flex gap-4">
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    <Twitter className="w-5 h-5" />
                  </Link>
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    <Github className="w-5 h-5" />
                  </Link>
                  <Link href="#" className="text-slate-400 hover:text-white transition-colors">
                    <Linkedin className="w-5 h-5" />
                  </Link>
                </div>
              </div>
              
              {/* Product */}
              <div>
                <h4 className="text-white font-semibold mb-4">Product</h4>
                <ul className="space-y-2">
                  <li><Link href="#features" className="text-sm text-slate-400 hover:text-white transition-colors">Features</Link></li>
                  <li><Link href="/pricing" className="text-sm text-slate-400 hover:text-white transition-colors">Pricing</Link></li>
                  <li><Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Integrations</Link></li>
                  <li><Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">API Docs</Link></li>
                </ul>
              </div>
              
              {/* Company */}
              <div>
                <h4 className="text-white font-semibold mb-4">Company</h4>
                <ul className="space-y-2">
                  <li><Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">About</Link></li>
                  <li><Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Blog</Link></li>
                  <li><Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Careers</Link></li>
                  <li><Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Contact</Link></li>
                </ul>
              </div>
              
              {/* Legal */}
              <div>
                <h4 className="text-white font-semibold mb-4">Legal</h4>
                <ul className="space-y-2">
                  <li><Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Privacy Policy</Link></li>
                  <li><Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Terms of Service</Link></li>
                  <li><Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Security</Link></li>
                  <li><Link href="#" className="text-sm text-slate-400 hover:text-white transition-colors">Compliance</Link></li>
                </ul>
              </div>
            </div>
            
            <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-slate-500">
                &copy; {new Date().getFullYear()} SentinelStack. All rights reserved.
              </p>
              <div className="flex gap-6">
                <Link href="#" className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
                  Status
                </Link>
                <Link href="#" className="text-xs text-slate-500 hover:text-slate-400 transition-colors">
                  Changelog
                </Link>
              </div>
            </div>
          </div>
        </footer>
    )
}
