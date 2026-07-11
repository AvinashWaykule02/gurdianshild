export default function LoadingSpinner({ label = 'Loading…' }) {
    return (
        <div className="flex items-center gap-2 text-sm text-gray-400">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
            </svg>
            {label}
        </div>
    );
}
