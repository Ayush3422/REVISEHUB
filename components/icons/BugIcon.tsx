
import React from 'react';

export const BugIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect width="8" height="14" x="8" y="6" rx="4"></rect>
    <path d="m19 7-3 2"></path>
    <path d="m5 7 3 2"></path>
    <path d="m19 19-3-2"></path>
    <path d="m5 19 3-2"></path>
    <path d="M20 13h-4"></path>
    <path d="M4 13h4"></path>
    <path d="m15 20 .5-3"></path>
    <path d="m9 20-.5-3"></path>
  </svg>
);
