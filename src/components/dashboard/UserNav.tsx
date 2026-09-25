'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar-1');

export function UserNav() {
  const { user, logout } = useAuth();
  const router = useRouter();

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-9 w-9 rounded-full p-0 ring-offset-[#02080b] transition-[background-color,transform] duration-150 hover:bg-cyan-300/[0.045] focus-visible:ring-cyan-300/30"
          aria-label="Open account menu"
        >
          <Avatar className="h-9 w-9 border border-cyan-200/10">
            {userAvatar ? <AvatarImage src={userAvatar.imageUrl} alt="User avatar" data-ai-hint={userAvatar.imageHint} /> : null}
            <AvatarFallback>{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 border-cyan-200/10 bg-[#071317] text-slate-100 shadow-2xl shadow-black/40" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name || 'Account'}</p>
            <p className="text-xs leading-none text-slate-500">{user.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/[0.06]" />
        <DropdownMenuItem onClick={() => router.push('/dashboard/settings')} className="focus:bg-cyan-300/[0.08] focus:text-cyan-50">
          <Settings className="mr-2 h-4 w-4" />
          <span>Workspace settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-white/[0.06]" />
        <DropdownMenuItem onClick={() => logout()} className="text-rose-200 focus:bg-rose-300/[0.08] focus:text-rose-100">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
