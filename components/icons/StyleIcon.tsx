
import React from 'react';

export const StyleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <circle cx="12" cy="5" r="3"></circle>
    <path d="M12 8v11"></path>
    <path d="M12 11h4"></path>
    <path d="M12 11H8"></path>
    <path d="M6 14h12"></path>
    <path d="M6 14v5h12v-5"></path>
  </svg>
);
