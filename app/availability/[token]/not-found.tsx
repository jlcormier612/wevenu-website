export default function AvailabilityNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F5F1]">
      <div className="max-w-sm space-y-3 px-6 text-center">
        <h1 className="font-heading text-xl font-medium text-[#5D6F5D]">
          This availability link is not active.
        </h1>
        <p className="text-sm text-[#B8AEA1]">
          Ask the venue for a current link to see which dates are available.
        </p>
      </div>
    </div>
  );
}
