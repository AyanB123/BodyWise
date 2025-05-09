
import Link from 'next/link';
import type { SVGProps } from 'react';
import { Target } from 'lucide-react'; 

export default function Logo() {
  return (
    <Link 
      href="/" 
      className="flex items-center space-x-2.5 text-3xl font-bold group"
      aria-label="BodyWise Home"
    >
      <Target className="h-9 w-9 text-primary group-hover:text-primary/80 transition-colors" />
      <span className="tracking-tight">
        <span className="text-primary group-hover:text-primary/80 transition-colors">Body</span>
        <span className="text-foreground group-hover:text-foreground/80 transition-colors">Wise</span>
      </span>
    </Link>
  );
}
