import Badge from '../ui/Badge';
import Card from '../ui/Card';

export default function TransactionTable({ transactions, loading }) {
    if (loading) {
        return <Card title="Recent transactions" subtitle="Loading from backend…" />;
    }

    return (
        <Card title="Recent transactions" subtitle="Latest entries for this user">
            <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="min-w-full divide-y divide-white/10 text-sm">
                    <thead className="bg-surface-700/70 text-left text-xs uppercase tracking-wider text-gray-400">
                        <tr>
                            <th className="px-4 py-3">ID</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3">Created</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/10 bg-surface-800/40">
                        {transactions.length === 0 ? (
                            <tr>
                                <td className="px-4 py-6 text-center text-gray-400" colSpan="5">
                                    No transactions yet.
                                </td>
                            </tr>
                        ) : (
                            transactions.map((transaction) => (
                                <tr key={transaction.id} className="hover:bg-white/5">
                                    <td className="px-4 py-3 text-gray-300">#{transaction.id}</td>
                                    <td className="px-4 py-3">
                                        <Badge tone={transaction.type === 'DEBIT' ? 'warning' : 'success'}>{transaction.type || 'N/A'}</Badge>
                                    </td>
                                    <td className="px-4 py-3 text-gray-100">${Number(transaction.amount).toFixed(2)}</td>
                                    <td className="px-4 py-3 text-gray-400">{transaction.description}</td>
                                    <td className="px-4 py-3 text-gray-500">{new Date(transaction.createdAt).toLocaleString()}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
