// Sello "Desarrollado por sincrono.pro". Hereda el color del texto del contenedor.
type Props = { className?: string; label?: string };

export default function SincronoBadge({ className = "", label = "Desarrollado por" }: Props) {
  return (
    <a
      href="https://sincrono.pro"
      target="_blank"
      rel="noopener"
      title="Desarrollado por SINCRONO"
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, lineHeight: 1, color: "inherit", opacity: 0.75, textDecoration: "none", transition: "opacity .2s" }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.75")}
    >
      <svg viewBox="240 468 556 420" width={18} height={14} aria-hidden="true">
        <path fill="#a3a3a3" d="M459.66,675.53c26.62-34.93,44.4-75.45,94.09-78.73,23.04-1.52,53.65-1,76.92,0,69.55,2.98,139.8,35.21,156.49,108.55,23.02,101.15-69.32,173.06-162,177.74l-379.62-.05c13.93-47.52,69.48-75.88,116.29-78.78,73.42-4.54,151.64,4.16,225.27.03,45.51-2.55,92.68-30.77,88.56-82.01-4.03-50.17-63.26-46.47-99.21-46.75-38.91-.3-77.88.41-116.79,0Z" />
        <path fill="#00c3ff" d="M576.46,675.53c-11.11,15.35-21.9,31.59-33.93,46.22-15.94,19.4-34.47,30.74-60.16,32.51-50.7,3.49-116.96,2.02-162.36-22.06-142-75.33-63.12-255.92,78.9-259.6l390.75.04c-1.23,12.01-9.34,24.33-17.14,33.36-24.47,28.37-64.01,43.52-101.01,45.42-77.86,4-159.11-3.09-237.32-.03-82.23,7.45-111.02,117.78-7.42,124.12,10.62.65,22.15-.1,32.9,0,38.91.41,77.88-.3,116.79,0Z" />
      </svg>
      <span>
        {label} <strong style={{ fontWeight: 700 }}>sincrono.pro</strong>
      </span>
    </a>
  );
}
