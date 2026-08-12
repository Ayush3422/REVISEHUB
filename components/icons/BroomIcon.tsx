import React from 'react';

export const BroomIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
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
    <path d="m13 11 9-9"></path>
    <path d="M14.6 12.6c.8.8.9 2 .2 2.7l-1.3 1.3c-.7.7-2 .6-2.7-.2L5.6 11.2c-.8-.8-.9-2-.2-2.7l1.3-1.3c.7-.7 2-.6 2.7.2Z"></path>
    <path d="m8 14-4.5 4.5a2.1 2.1 0 0 0 3 3L11 17"></path>
  </svg>
);
