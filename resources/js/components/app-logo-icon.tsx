import type { SVGAttributes } from 'react';

export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            {...props}
            viewBox="0 0 48 48"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <path
                d="M24 3.5 41.5 13.6v20.8L24 44.5 6.5 34.4V13.6L24 3.5Z"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinejoin="round"
            />
            <path
                d="M15.5 15.5v17M32.5 15.5v17M15.5 24h17"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
            />
        </svg>
    );
}
