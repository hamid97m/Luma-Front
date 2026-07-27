import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { t } from '../i18n.js';
import { api } from '../api.js';
const STEPS = ['age', 'gender', 'lookingFor', 'photos', 'bio'];
const STORAGE_KEY = 'profile_setup';
export function ProfileSetup({ onComplete }) {
    const [stepIdx, setStepIdx] = useState(0);
    const [form, setForm] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? JSON.parse(saved) : { age: '', gender: 'man', looking_for: 'women', bio: '' };
    });
    const [saving, setSaving] = useState(false);
    const step = STEPS[stepIdx];
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
    }, [form]);
    const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    const finish = async () => {
        setSaving(true);
        try {
            await api.profile.update({
                age: Number(form.age),
                gender: form.gender,
                looking_for: form.looking_for,
                bio: form.bio || null,
            });
            localStorage.removeItem(STORAGE_KEY);
            onComplete();
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs("div", { className: "flex flex-col h-screen p-6", children: [_jsx("div", { className: "flex gap-1 mb-8", children: STEPS.map((_, i) => (_jsx("div", { className: "h-1 flex-1 rounded-full", style: { background: i <= stepIdx ? 'var(--tg-theme-button-color)' : '#e0e0e0' } }, i))) }), _jsxs("div", { className: "flex-1", children: [step === 'age' && (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("h2", { className: "text-2xl font-bold", children: t.setup.yourAge }), _jsx("input", { type: "number", min: 18, max: 99, value: form.age, onChange: (e) => setForm((f) => ({ ...f, age: e.target.value })), className: "w-full p-4 text-xl border-2 rounded-2xl text-center", placeholder: "\u06F2\u06F5" }), _jsx("button", { onClick: next, disabled: !form.age || Number(form.age) < 18, className: "w-full py-4 rounded-2xl font-semibold disabled:opacity-40", style: { background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }, children: t.next })] })), step === 'gender' && (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("h2", { className: "text-2xl font-bold", children: t.setup.yourGender }), ['man', 'woman'].map((g) => (_jsx("button", { onClick: () => setForm((f) => ({ ...f, gender: g })), className: `w-full py-4 rounded-2xl font-semibold border-2 ${form.gender === g ? 'border-blue-500' : 'border-gray-200'}`, children: g === 'man' ? t.setup.man : t.setup.woman }, g))), _jsx("button", { onClick: next, className: "w-full py-4 rounded-2xl font-semibold", style: { background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }, children: t.next })] })), step === 'lookingFor' && (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("h2", { className: "text-2xl font-bold", children: t.setup.lookingFor }), [['men', t.setup.lookingForMen], ['women', t.setup.lookingForWomen], ['both', t.setup.lookingForBoth]].map(([val, label]) => (_jsx("button", { onClick: () => setForm((f) => ({ ...f, looking_for: val })), className: `w-full py-4 rounded-2xl font-semibold border-2 ${form.looking_for === val ? 'border-blue-500' : 'border-gray-200'}`, children: label }, val))), _jsx("button", { onClick: next, className: "w-full py-4 rounded-2xl font-semibold", style: { background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }, children: t.next })] })), step === 'photos' && (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("h2", { className: "text-2xl font-bold", children: t.setup.addPhotos }), _jsx("p", { className: "opacity-60", children: t.setup.photosHint }), _jsxs("label", { className: "w-full py-12 rounded-2xl border-2 border-dashed text-center cursor-pointer text-4xl", children: ["\uD83D\uDCF7", _jsx("input", { type: "file", accept: "image/*", className: "hidden", onChange: async (e) => {
                                            const file = e.target.files?.[0];
                                            if (file)
                                                await api.photos.uploadFile(file);
                                        } })] }), _jsx("button", { onClick: next, className: "w-full py-4 rounded-2xl font-semibold", style: { background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }, children: t.next }), _jsx("button", { onClick: next, className: "w-full py-3 opacity-60", children: t.skip })] })), step === 'bio' && (_jsxs("div", { className: "flex flex-col gap-4", children: [_jsx("h2", { className: "text-2xl font-bold", children: t.setup.bio }), _jsx("textarea", { rows: 4, value: form.bio, onChange: (e) => setForm((f) => ({ ...f, bio: e.target.value })), className: "w-full p-4 border-2 rounded-2xl resize-none", placeholder: t.setup.bioPlaceholder }), _jsx("button", { onClick: finish, disabled: saving, className: "w-full py-4 rounded-2xl font-semibold disabled:opacity-40", style: { background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }, children: saving ? '...' : t.setup.done })] }))] })] }));
}
