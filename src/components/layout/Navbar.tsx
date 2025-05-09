'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, Camera, ClipboardList, LineChart, Menu } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet'; // Added SheetClose
import { useState } from 'react';

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/capture', label: 'Capture', icon: Camera },
  { href: '/results', label: 'Results', icon: ClipboardList },
  { href: '/tracking', label: 'Track Stats', icon: LineChart },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const NavLink = ({ href, label, icon: Icon }: typeof navItems[0]) => (
     // SheetClose will automatically close the sheet on navigation
    <SheetClose asChild>
      <Link
        href={href}
        onClick={() => setMobileMenuOpen(false)} // Still good to have for explicit control
        className={cn(
          "flex items-center px-3 py-2.5 rounded-md text-base font-medium transition-all duration-200 ease-in-out",
          pathname === href
            ? 'bg-primary/15 text-primary hover:bg-primary/25 shadow-sm'
            : 'text-foreground/70 hover:text-primary hover:bg-primary/5'
        )}
        aria-current={pathname === href ? "page" : undefined}
      >
        <Icon className="mr-2.5 h-5 w-5 flex-shrink-0" />
        {label}
      </Link>
    </SheetClose>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/70 bg-background/90 backdrop-blur-lg supports-[backdrop-filter]:bg-background/75">
      <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
        <Logo />
        <nav className="hidden md:flex items-center space-x-2 lg:space-x-3">
          {navItems.map((item) => (
             <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === item.href
                  ? 'bg-primary/10 text-primary hover:bg-primary/20'
                  : 'text-foreground/70 hover:text-primary hover:bg-muted'
              )}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <item.icon className="mr-2 h-5 w-5" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="md:hidden">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation menu">
                <Menu className="h-7 w-7 text-foreground/80" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] p-0 pt-6 bg-background flex flex-col">
              <div className="px-6 mb-6">
                <Logo />
              </div>
              <nav className="flex flex-col space-y-3 px-4 flex-grow">
                {navItems.map((item) => (
                  <NavLink key={item.href} {...item} />
                ))}
              </nav>
               <div className="p-4 mt-auto border-t border-border/70">
                <SheetClose asChild>
                   <Button variant="outline" className="w-full" onClick={() => setMobileMenuOpen(false)}>Close Menu</Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
