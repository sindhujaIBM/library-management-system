import { useState } from 'react';

type BookFormat = 'physical' | 'audiobook' | 'ebook';

interface BookFormData {
  ISBN: string;
  title: string;
  author: string;
  genre: string;
  series?: string;
  seriesPosition?: number;
  releaseDate?: string;
  totalCopies: number;
  coverImageUrl?: string;
  formats: BookFormat[];
}

interface Props {
  initial?: Partial<BookFormData>;
  onSubmit: (data: BookFormData) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
}

const GENRES = ['Fiction', 'Non-Fiction', 'Science Fiction', 'Fantasy', 'Mystery', 'Biography', 'History', 'Science', 'Self-Help', 'Children'];
const FORMAT_OPTIONS: { value: BookFormat; label: string; icon: string }[] = [
  { value: 'physical', label: 'Physical', icon: '📚' },
  { value: 'audiobook', label: 'Audiobook', icon: '🎧' },
  { value: 'ebook', label: 'Kindle / eBook', icon: '📱' },
];

export function BookForm({ initial, onSubmit, onCancel, isEdit }: Props) {
  const [form, setForm] = useState<BookFormData>({
    ISBN: initial?.ISBN ?? '',
    title: initial?.title ?? '',
    author: initial?.author ?? '',
    genre: initial?.genre ?? '',
    series: initial?.series ?? '',
    seriesPosition: initial?.seriesPosition,
    releaseDate: initial?.releaseDate ?? '',
    totalCopies: initial?.totalCopies ?? 1,
    coverImageUrl: initial?.coverImageUrl ?? '',
    formats: (initial?.formats as BookFormat[]) ?? ['physical'],
  });

  function toggleFormat(fmt: BookFormat) {
    setForm(f => {
      const has = f.formats.includes(fmt);
      if (has && f.formats.length === 1) return f; // keep at least one
      return { ...f, formats: has ? f.formats.filter(x => x !== fmt) : [...f.formats, fmt] };
    });
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof BookFormData, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onSubmit(form);
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message
        : 'An error occurred';
      setError(msg ?? 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  const inputCls = 'w-full border border-stone-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500';

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">ISBN *</label>
          <input className={inputCls} value={form.ISBN} onChange={e => set('ISBN', e.target.value)} required disabled={isEdit} placeholder="978-..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Copies *</label>
          <input className={inputCls} type="number" min={1} value={form.totalCopies} onChange={e => set('totalCopies', parseInt(e.target.value))} required />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Title *</label>
        <input className={inputCls} value={form.title} onChange={e => set('title', e.target.value)} required />
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Author *</label>
        <input className={inputCls} value={form.author} onChange={e => set('author', e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Genre *</label>
          <select className={inputCls} value={form.genre} onChange={e => set('genre', e.target.value)} required>
            <option value="">Select genre</option>
            {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Release Date</label>
          <input className={inputCls} type="date" value={form.releaseDate} onChange={e => set('releaseDate', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Series</label>
          <input className={inputCls} value={form.series} onChange={e => set('series', e.target.value)} placeholder="e.g. Harry Potter" />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Series #</label>
          <input className={inputCls} type="number" min={1} value={form.seriesPosition ?? ''} onChange={e => set('seriesPosition', parseInt(e.target.value))} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Cover Image URL</label>
        <input className={inputCls} value={form.coverImageUrl} onChange={e => set('coverImageUrl', e.target.value)} placeholder="https://..." />
      </div>

      <div>
        <label className="block text-xs font-medium text-stone-600 mb-2">Available Formats *</label>
        <div className="flex gap-3">
          {FORMAT_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => toggleFormat(opt.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                form.formats.includes(opt.value)
                  ? 'bg-brand-50 border-brand-400 text-brand-700 font-medium'
                  : 'border-stone-200 text-stone-500 hover:border-stone-300'
              }`}
            >
              <span>{opt.icon}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading}
          className="flex-1 bg-brand-600 hover:bg-brand-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50">
          {loading ? 'Saving…' : (isEdit ? 'Save Changes' : 'Add Book')}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-700 py-2 rounded-lg text-sm font-medium transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}
