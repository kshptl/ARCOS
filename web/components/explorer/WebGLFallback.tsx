import type { CountyMetadata } from '@/lib/data/schemas';

export interface WebGLFallbackProps {
  counties: CountyMetadata[];
  reason: string;
}

// Placeholder — real impl in Task 17.
export function WebGLFallback({ counties, reason }: WebGLFallbackProps) {
  return (
    <div role="alert">
      {reason} ({counties.length} counties)
    </div>
  );
}
