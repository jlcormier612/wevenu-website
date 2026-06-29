export default function RsvpNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F7F5F1]">
      <div className="text-center space-y-3 px-6 max-w-sm">
        <p className="text-4xl">💌</p>
        <h1 className="font-heading text-xl font-medium text-[#5D6F5D]">
          This RSVP link isn't valid.
        </h1>
        <p className="text-sm text-[#B8AEA1]">
          Check your invitation email for the correct link, or contact the couple directly.
        </p>
      </div>
    </div>
  );
}
