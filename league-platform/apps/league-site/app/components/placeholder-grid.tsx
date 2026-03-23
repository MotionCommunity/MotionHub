type PlaceholderGridProps = {
  items: Array<{ title: string; text: string }>;
};

export function PlaceholderGrid({ items }: PlaceholderGridProps) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <article key={item.title} className="card">
          <h2 className="text-2xl font-semibold">{item.title}</h2>
          <p className="mt-2 text-sm text-muted">{item.text}</p>
        </article>
      ))}
    </section>
  );
}

