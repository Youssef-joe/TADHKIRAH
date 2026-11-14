/** Rendered per request so its scripts carry the CSP nonce (see src/proxy.ts). */
export const dynamic = 'force-dynamic';

export default function VerifyLayout({ children }: LayoutProps<'/[locale]/verify'>) {
  return children;
}
