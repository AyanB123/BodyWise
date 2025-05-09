
import Link from 'next/link';
import type { SVGProps } from 'react';

// Using a more abstract/fitting icon - Target or a stylized human figure might be good.
// For simplicity, let's use a Lucide icon that fits.
import { Target } from 'lucide-react'; // Or use a custom SVG if available.

// If you had a custom SVG:
// function BodyWiseIcon(props: SVGProps<SVGSVGElement>) {
//   return (
//     <svg /* your modern SVG code here */ {...props} />
//   )
// }


export default function Logo() {
  return (
    <Link 
      href="/" 
      className="flex items-center space-x-2.5 text-3xl font-bold text-primary hover:text-primary/80 transition-colors group"
      aria-label="BodyWise Home"
    >
      {/* Replace with BodyWiseIcon if you have a custom SVG */}
      <Target className="h-9 w-9 text-accent group-hover:text-accent/80 transition-colors" />
      <span className="tracking-tight">Body<span className="font-normal text-foreground/80 group-hover:text-foreground/70 transition-colors">Wise</span></span>
    </Link>
  );
}
