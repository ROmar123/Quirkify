export default function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center ${className}`}>
      <img
        src="/logo.png"
        alt="Quirkify"
        className="h-10 w-auto object-contain"
      />
    </div>
  );
}
