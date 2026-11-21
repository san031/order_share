// Text input with an optional label above it
export default function Input({ label, className = "", ...props }) {
  const input = <input className={`input ${className}`} {...props} />;
  if (!label) return input;
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {input}
    </label>
  );
}
