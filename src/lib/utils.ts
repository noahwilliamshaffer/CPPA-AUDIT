import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes without conflicts — standard shadcn pattern. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
