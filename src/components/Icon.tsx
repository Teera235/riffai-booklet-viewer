import type { SVGProps } from 'react'

type IconName =
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'copy'
  | 'download'
  | 'expand'
  | 'fit'
  | 'library'
  | 'menu'
  | 'minus'
  | 'plus'
  | 'share'
  | 'single-page'
  | 'spread'
  | 'trash'
  | 'upload'

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 20, ...props }: IconProps) {
  const paths = (() => {
    switch (name) {
      case 'chevron-left':
        return <path d="m15 18-6-6 6-6" />
      case 'chevron-right':
        return <path d="m9 18 6-6-6-6" />
      case 'close':
        return <><path d="m18 6-12 12" /><path d="m6 6 12 12" /></>
      case 'copy':
        return <><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>
      case 'download':
        return <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5" /><path d="M12 15V3" /></>
      case 'expand':
        return <><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></>
      case 'fit':
        return <><rect width="18" height="14" x="3" y="5" rx="1" /><path d="m7 9-2 3 2 3" /><path d="m17 9 2 3-2 3" /></>
      case 'library':
        return <><path d="m16 6 4 14" /><path d="M12 6v14" /><path d="M8 8v12" /><path d="M4 4v16" /></>
      case 'menu':
        return <><path d="M4 6h16" /><path d="M4 12h16" /><path d="M4 18h16" /></>
      case 'minus':
        return <path d="M5 12h14" />
      case 'plus':
        return <><path d="M12 5v14" /><path d="M5 12h14" /></>
      case 'share':
        return <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4" /><path d="m8.6 13.5 6.8 4" /></>
      case 'single-page':
        return <rect width="13" height="18" x="5.5" y="3" rx="1" />
      case 'spread':
        return <><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 1 3 18.5z" /><path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H12v18h6.5a2.5 2.5 0 0 0 2.5-2.5z" /></>
      case 'trash':
        return <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="m19 6-1 15H6L5 6" /><path d="M10 11v5" /><path d="M14 11v5" /></>
      case 'upload':
        return <><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M20 15v5H4v-5" /></>
    }
  })()

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      {...props}
    >
      {paths}
    </svg>
  )
}
