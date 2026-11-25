import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const CheckIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 8.5 6.5 11.5 12.5 5" />
  </Icon>
);

export const CloseIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </Icon>
);

export const CopyIcon = (props: IconProps) => (
  <Icon {...props}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="2" />
    <path d="M10.5 3.5v-.25A1.75 1.75 0 0 0 8.75 1.5h-5.5A1.75 1.75 0 0 0 1.5 3.25v5.5c0 .97.78 1.75 1.75 1.75h.25" />
  </Icon>
);

export const AlertIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="6.25" />
    <path d="M8 5v3.5M8 11v.01" />
  </Icon>
);

export const PlusIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 3.5v9M3.5 8h9" />
  </Icon>
);

export const SearchIcon = (props: IconProps) => (
  <Icon {...props}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m10.5 10.5 3 3" />
  </Icon>
);

export const DownloadIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 2.5v7.5M4.75 7 8 10.25 11.25 7M3 13.5h10" />
  </Icon>
);

export const SignIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="m9.5 3.5 3 3L6 13H3v-3l6.5-6.5Z" />
  </Icon>
);

export const PlayIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 3.25v9.5L12.5 8 5 3.25Z" />
  </Icon>
);

export const InvoiceIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M3.5 1.75h9v12.5l-2.25-1.5L8 14.25l-2.25-1.5-2.25 1.5V1.75ZM6 5.5h4M6 8.5h4" />
  </Icon>
);

export const ArrowDownIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M8 3v10M4 9l4 4 4-4" />
  </Icon>
);

export const ExternalIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M5 11 11 5M6 5h5v5" />
  </Icon>
);

export const MenuIcon = (props: IconProps) => (
  <Icon {...props}>
    <path d="M2 5.5h12M2 10.5h12" />
  </Icon>
);

export const SpinnerIcon =({ className, ...props }: IconProps) => (
  <Icon className={`motion-safe:animate-spin ${className ?? ""}`} {...props}>
    <path d="M8 1.75a6.25 6.25 0 1 1-6.25 6.25" />
  </Icon>
);
