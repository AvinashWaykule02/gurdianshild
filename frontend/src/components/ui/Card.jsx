export default function Card({ title, subtitle, children, className = '' }) {
    return (
        <div className={`rounded-2xl border border-white/10 bg-surface-800/70 p-5 shadow-lg shadow-black/20 ${className}`}>
            {(title || subtitle) && (
                <div className="mb-4">
                    {title && <h3 className="text-sm font-semibold text-white">{title}</h3>}
                    {subtitle && <p className="mt-1 text-sm text-gray-400">{subtitle}</p>}
                </div>
            )}
            {children}
        </div>
    );
}
