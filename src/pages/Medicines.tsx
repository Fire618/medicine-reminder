export default function Medicines() {
  return (
    <section aria-labelledby="medicines-heading">
      <div className="page-heading">
        <h1 id="medicines-heading">Medicines</h1>
        <button type="button" className="btn btn--primary" disabled>
          Add medicine
        </button>
      </div>
      <p className="muted">Your medicine list will appear here.</p>
    </section>
  );
}
