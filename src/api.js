const BASE = import.meta.env.VITE_API_URL;
async function request(path, options) {
    const initData = window.Telegram?.WebApp?.initData ?? '';
    const res = await fetch(`${BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: initData,
            ...options?.headers,
        },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
    }
    return res.json();
}
export const api = {
    auth: {
        verify: (initData) => request('/auth/verify', { method: 'POST', body: JSON.stringify({ initData }) }),
    },
    profile: {
        get: () => request('/profile/me'),
        update: (data) => request('/profile/me', { method: 'PUT', body: JSON.stringify(data) }),
    },
    photos: {
        getUploadUrl: (contentType) => request('/profile/me/photos/upload-url', { method: 'POST', body: JSON.stringify({ contentType }) }),
        delete: (photoId) => request(`/profile/me/photos/${photoId}`, { method: 'DELETE' }),
        reorder: (order) => request('/profile/me/photos/reorder', {
            method: 'PATCH',
            body: JSON.stringify({ order }),
        }),
        uploadFile: async (file) => {
            const { uploadUrl, publicUrl } = await api.photos.getUploadUrl(file.type);
            await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
            return publicUrl;
        },
    },
    discovery: {
        feed: () => request('/discovery'),
    },
    swipes: {
        swipe: (targetUserId, direction) => request('/swipes', {
            method: 'POST',
            body: JSON.stringify({ targetUserId, direction }),
        }),
    },
    matches: {
        list: () => request('/matches'),
    },
};
