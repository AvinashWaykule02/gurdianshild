export default function Badge({ children, tone = 'neutral', className = '' }) {
    const tones = {
        neutral: 'border-white/10 bg-white/5 text-gray-200',
        success: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
        danger: 'border-red-500/20 bg-red-500/10 text-red-300',
        warning: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
        info: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
    };

    return (
        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${tones[tone] || tones.neutral} ${className}`}>
            {children}
        </span>
    );
}
