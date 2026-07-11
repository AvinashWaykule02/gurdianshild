export default function Button({ children, variant = 'primary', className = '', disabled = false, ...props }) {
    const styles = {
        primary: 'rounded-xl bg-gradient-to-r from-shield-600 to-shield-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-shield-600/25 transition hover:from-shield-500 hover:to-shield-400 disabled:opacity-50',
        secondary: 'rounded-xl border border-white/10 bg-surface-700/70 px-4 py-2 text-sm font-semibold text-gray-200 transition hover:bg-surface-600 disabled:opacity-50',
        danger: 'rounded-xl bg-red-600/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:opacity-50',
    };

    return (
        <button className={`${styles[variant] || styles.primary} ${className}`} disabled={disabled} {...props}>
            {children}
        </button>
    );
}
