export default function VendorPortalNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F4F2]">
      <div className="text-center space-y-3 px-6 max-w-sm">
        <p className="text-4xl">🔒</p>
        <h1 className="text-xl font-semibold text-[#1A1A1A]">
          This vendor portal link isn't valid.
        </h1>
        <p className="text-sm text-[#666]">
          Contact the venue coordinator for an updated link.
        </p>
      </div>
    </div>
  );
}
