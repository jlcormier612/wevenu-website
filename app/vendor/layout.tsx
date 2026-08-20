/**
 * Vendor segment root. Claim (`/vendor/accept`) and the authenticated
 * workspace (`(workspace)/*`) are siblings so claim never shares the shell
 * layout — soft nav after accept always mounts VendorAppShell.
 */
export default function VendorRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
