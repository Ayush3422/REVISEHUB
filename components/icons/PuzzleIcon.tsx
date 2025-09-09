import React from 'react';

export const PuzzleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="M14 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2"></path>
    <path d="M16 12h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2v-2a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2z"></path>
  </svg>
);
