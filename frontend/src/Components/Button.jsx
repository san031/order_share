// variant: "primary" (orange), "secondary" (outlined), "ghost" (text only)
export default function Button({ variant = "primary", className = "", type = "button", ...props }) {
  return <button type={type} className={`btn btn-${variant} ${className}`} {...props} />;
}
