import { photosForBrochureLayout } from "@/lib/brochures/photo-layout";
import type { BrochurePhotoLayout } from "@/lib/brochures/photo-layout";
import { cn } from "@/lib/utils";

function Photo({ src, className, alt = "" }: { src: string; className?: string; alt?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={cn("h-full w-full object-cover", className)} />
  );
}

/**
 * Curated brochure photography. Empty slots are omitted — never broken boxes.
 */
export function BrochurePhotoComposition({
  urls,
  layout,
}: {
  urls: string[];
  layout: BrochurePhotoLayout;
}) {
  const { hero, supporting } = photosForBrochureLayout(urls, layout);
  if (!hero) return null;

  if (layout === "classic") {
    return (
      <div className="space-y-3 overflow-x-hidden">
        <div className="aspect-[16/9] w-full overflow-hidden rounded-md">
          <Photo src={hero} />
        </div>
        {supporting.length > 0 ? (
          <div className={cn("grid gap-3", supporting.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
            {supporting.map((src) => (
              <div key={src} className="aspect-[4/3] overflow-hidden rounded-md">
                <Photo src={src} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (layout === "gallery") {
    return (
      <div className="space-y-3 overflow-x-hidden">
        <div className="aspect-[16/9] w-full overflow-hidden rounded-md">
          <Photo src={hero} />
        </div>
        {supporting.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {supporting.map((src) => (
              <div key={src} className="aspect-square overflow-hidden rounded-md">
                <Photo src={src} />
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (layout === "story") {
    return (
      <div className="space-y-6 overflow-x-hidden">
        <div className="aspect-[5/3] w-full overflow-hidden rounded-md">
          <Photo src={hero} />
        </div>
        {supporting[0] ? (
          <div className="mx-auto max-w-md aspect-[4/5] overflow-hidden rounded-md">
            <Photo src={supporting[0]} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-3 overflow-x-hidden">
      <div className="col-span-12 overflow-hidden rounded-md sm:col-span-7">
        <div className="aspect-[4/5] sm:aspect-auto sm:h-full sm:min-h-[20rem]">
          <Photo src={hero} />
        </div>
      </div>
      {supporting.length > 0 ? (
        <div className="col-span-12 grid grid-cols-2 gap-3 sm:col-span-5 sm:grid-cols-1">
          {supporting.map((src) => (
            <div key={src} className="aspect-[4/3] overflow-hidden rounded-md">
              <Photo src={src} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
