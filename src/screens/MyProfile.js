import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { t } from '../i18n.js';
import { api } from '../api.js';
import { useAuthStore } from '../store.js';
export function MyProfile() {
    const { user: storeUser, setUser } = useAuthStore();
    const [profile, setProfile] = useState(storeUser);
    useEffect(() => {
        api.profile.get().then((p) => { setProfile(p); setUser(p); });
    }, []);
    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        await api.photos.uploadFile(file);
        const p = await api.profile.get();
        setProfile(p);
        setUser(p);
    };
    const handleDeletePhoto = async (photoId) => {
        await api.photos.delete(photoId);
        const p = await api.profile.get();
        setProfile(p);
        setUser(p);
    };
    if (!profile)
        return _jsx("div", { className: "flex items-center justify-center h-full", children: _jsx("div", { className: "animate-pulse text-3xl", children: "\uD83D\uDC64" }) });
    return (_jsxs("div", { className: "flex flex-col h-full overflow-y-auto", children: [_jsx("h1", { className: "text-xl font-bold p-4 border-b", children: t.profile.title }), _jsxs("div", { className: "p-4", children: [_jsx("h2", { className: "font-semibold mb-3", children: t.profile.photos }), _jsxs("div", { className: "grid grid-cols-3 gap-2 mb-6", children: [profile.photos.map((photo) => (_jsxs("div", { className: "relative aspect-square rounded-xl overflow-hidden bg-gray-100", children: [_jsx("img", { src: photo.url, alt: "", className: "w-full h-full object-cover" }), _jsx("button", { onClick: () => handleDeletePhoto(photo.id), className: "absolute top-1 left-1 bg-black/50 text-white rounded-full w-6 h-6 text-xs", children: "\u2715" })] }, photo.id))), profile.photos.length < 6 && (_jsxs("label", { className: "aspect-square rounded-xl border-2 border-dashed flex items-center justify-center text-2xl cursor-pointer", children: ["+", _jsx("input", { type: "file", accept: "image/*", className: "hidden", onChange: handlePhotoUpload })] }))] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "p-4 rounded-2xl bg-gray-50", children: [_jsx("p", { className: "text-sm opacity-60", children: "\u0627\u0633\u0645" }), _jsx("p", { className: "font-semibold", children: profile.name })] }), _jsxs("div", { className: "p-4 rounded-2xl bg-gray-50", children: [_jsx("p", { className: "text-sm opacity-60", children: "\u0633\u0646" }), _jsx("p", { className: "font-semibold", children: profile.age })] }), _jsxs("div", { className: "p-4 rounded-2xl bg-gray-50", children: [_jsx("p", { className: "text-sm opacity-60", children: "\u062F\u0631\u0628\u0627\u0631\u0647 \u0645\u0646" }), _jsx("p", { className: "font-semibold", children: profile.bio ?? '—' })] })] })] })] }));
}
