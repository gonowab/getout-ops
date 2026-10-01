// Visas direkt när man byter sida, medan servern hämtar datan.
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Laddar">
      <div className="h-6 w-40 rounded bg-hover" />
      <div className="mt-2 h-4 w-64 rounded bg-hover" />
      <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-28 bg-canvas" />
        ))}
      </div>
      <div className="mt-8 flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-11 rounded-lg bg-canvas" />
        ))}
      </div>
    </div>
  );
}
