import { useState } from 'react';
import { transactionApi } from '../../api/transactionApi';
import Button from '../ui/Button';
import Card from '../ui/Card';

export default function TransactionForm({ onCreated, locked = false }) {
    const [form, setForm] = useState({ amount: '', description: '', type: 'DEBIT' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await transactionApi.create({
                amount: Number(form.amount),
                description: form.description,
                type: form.type,
            });
            setForm({ amount: '', description: '', type: 'DEBIT' });
            if (onCreated) onCreated();
        } catch (err) {
            setError(err.response?.data?.message || 'Could not create transaction');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card title="Create transaction" subtitle="This posts to the backend and triggers the outbox/audit pipeline">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="mb-1 block text-sm text-gray-400">Amount</label>
                    <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        className="input-field"
                        disabled={locked || loading}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm text-gray-400">Description</label>
                    <input
                        type="text"
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="input-field"
                        disabled={locked || loading}
                    />
                </div>
                <div>
                    <label className="mb-1 block text-sm text-gray-400">Type</label>
                    <select
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                        className="input-field"
                        disabled={locked || loading}
                    >
                        <option value="DEBIT">DEBIT</option>
                        <option value="CREDIT">CREDIT</option>
                    </select>
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
                <Button type="submit" disabled={locked || loading} className="w-full">
                    {loading ? 'Submitting…' : 'Create transaction'}
                </Button>
            </form>
        </Card>
    );
}
