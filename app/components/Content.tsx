import Image from "next/image";

interface GalleryItem {
  title: string;
  note: string;
  image: string;
}

interface GalleryProps {
  items: GalleryItem[];
}

export function Gallery({ items }: GalleryProps) {
  return (
    <div className="gallery-grid">
      {items.map((item) => (
        <figure className="gallery-item" key={item.title}>
          <Image src={item.image} alt={item.title} width={1200} height={900} sizes="(max-width: 760px) 100vw, (max-width: 980px) 50vw, 33vw" />
          <figcaption>
            <strong>{item.title}</strong>
            <span>{item.note}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

interface TestimonialsProps {
  items: Testimonial[];
}

export function Testimonials({ items }: TestimonialsProps) {
  return (
    <div className="testimonial-grid">
      {items.map((item) => (
        <article className="testimonial" key={item.name}>
          <p>
            <span aria-hidden="true">&ldquo;</span>
            {item.quote}
            <span aria-hidden="true">&rdquo;</span>
          </p>
          <div>
            <strong>{item.name}</strong>
            <span>{item.role}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
