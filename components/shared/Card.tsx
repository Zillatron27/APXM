import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Blueprint-style container with corner bracket accents.
 * Uses span elements for the four corners since ::before/::after only give us 2.
 */
export function Card({ children, className = '' }: CardProps) {
  const bracketSize = '8px';
  const bracketThickness = '2px';
  const bracketColor = 'border-prun-yellow/40';

  return (
    <div className={`relative bg-apxm-surface p-3 ${className}`}>
      {/* Top-left corner */}
      <span
        className={`absolute top-0 left-0 border-t-${bracketThickness} border-l-${bracketThickness} ${bracketColor}`}
        style={{ width: bracketSize, height: bracketSize, borderWidth: bracketThickness, borderStyle: 'solid', borderRight: 'none', borderBottom: 'none' }}
      />
      {/* Top-right corner */}
      <span
        className={`absolute top-0 right-0 ${bracketColor}`}
        style={{ width: bracketSize, height: bracketSize, borderWidth: bracketThickness, borderStyle: 'solid', borderLeft: 'none', borderBottom: 'none' }}
      />
      {/* Bottom-left corner */}
      <span
        className={`absolute bottom-0 left-0 ${bracketColor}`}
        style={{ width: bracketSize, height: bracketSize, borderWidth: bracketThickness, borderStyle: 'solid', borderRight: 'none', borderTop: 'none' }}
      />
      {/* Bottom-right corner */}
      <span
        className={`absolute bottom-0 right-0 ${bracketColor}`}
        style={{ width: bracketSize, height: bracketSize, borderWidth: bracketThickness, borderStyle: 'solid', borderLeft: 'none', borderTop: 'none' }}
      />
      {children}
    </div>
  );
}
