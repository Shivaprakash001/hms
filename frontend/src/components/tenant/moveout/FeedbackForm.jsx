import { useState } from 'react';

const DIMS = [
  { key: 'ratingCleanliness', label: 'Cleanliness', emoji: '🧹' },
  { key: 'ratingFood', label: 'Food', emoji: '🍽️' },
  { key: 'ratingWifi', label: 'WiFi', emoji: '📶' },
  { key: 'ratingManagement', label: 'Management', emoji: '👤' },
  { key: 'ratingMaintenance', label: 'Maintenance', emoji: '🔧' },
  { key: 'ratingSafety', label: 'Safety', emoji: '🛡️' },
  { key: 'ratingValue', label: 'Value', emoji: '💰' },
  { key: 'ratingNoise', label: 'Noise', emoji: '🔇' },
];

const STARS = ['😞', '😕', '😐', '🙂', '😊'];

export default function FeedbackForm({ requestId, actions, refetch }) {
  const [ratings, setRatings] = useState({});
  const [recommend, setRecommend] = useState(null);
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return null;

  const handleSubmit = async () => {
    const ok = await actions.submitFeedback(requestId, {
      ...ratings, wouldRecommend: recommend, improvementText: text,
    });
    if (ok) { setSubmitted(true); refetch(); }
  };

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">How was your stay?</h3>
      <p className="text-xs text-slate-500 mb-5">Your feedback is confidential and helps us improve.</p>

      <div className="space-y-4 mb-5">
        {DIMS.map(d => (
          <div key={d.key}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-slate-600">{d.emoji} {d.label}</span>
              {ratings[d.key] && <span className="text-xs text-slate-400">{ratings[d.key]}/5</span>}
            </div>
            <div className="flex gap-1.5">
              {[1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setRatings(p => ({ ...p, [d.key]: n }))}
                  className={`flex-1 h-9 rounded-lg text-base transition-all active:scale-95 ${
                    (ratings[d.key] || 0) >= n
                      ? 'bg-ops-accent/15 border-ops-accent/300 border'
                      : 'bg-slate-50 border border-slate-200'
                  }`}>
                  {STARS[n - 1]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium text-slate-600 mb-2">Would you recommend this hostel?</p>
        <div className="flex gap-2">
          {[true, false].map(v => (
            <button key={String(v)} onClick={() => setRecommend(v)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all active:scale-[0.97] ${
                recommend === v
                  ? 'border-ops-accent/400 bg-ops-accent/10 text-ops-accent'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}>
              {v ? '👍 Yes' : '👎 No'}
            </button>
          ))}
        </div>
      </div>

      <textarea value={text} onChange={e => setText(e.target.value)}
        placeholder="Any suggestions? (optional)"
        rows={2}
        className="w-full p-3 rounded-xl border border-slate-200 text-sm bg-white focus:ring-2 focus:ring-ops-accent/500/20 focus:border-ops-accent/400 outline-none resize-none transition-all mb-4"
      />

      <button onClick={handleSubmit} disabled={actions.submitting}
        className="w-full py-3 rounded-xl bg-ops-accent text-white text-sm font-semibold hover:bg-ops-accent/700 active:scale-[0.98] transition-all disabled:opacity-50">
        {actions.submitting ? 'Sending…' : 'Submit Feedback'}
      </button>
    </div>
  );
}
