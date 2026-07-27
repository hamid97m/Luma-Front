import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { t } from '../i18n.js';
import { api } from '../api.js';
export function Matches() {
    const [matches, setMatches] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        api.matches.list().then(({ matches }) => {
            setMatches(matches);
            setLoading(false);
        });
    }, []);
    if (loading)
        return _jsx("div", { className: "flex items-center justify-center h-full", children: _jsx("div", { className: "animate-pulse text-3xl", children: "\uD83D\uDCAC" }) });
    if (matches.length === 0) {
        return (_jsxs("div", { className: "flex flex-col items-center justify-center h-full gap-4 text-center p-8", children: [_jsx("div", { className: "text-5xl", children: "\uD83D\uDC94" }), _jsx("h2", { className: "text-xl font-bold", children: t.matches.empty }), _jsx("p", { className: "opacity-60", children: t.matches.emptyHint })] }));
    }
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsx("h1", { className: "text-xl font-bold p-4 border-b", children: t.matches.title }), _jsx("div", { className: "flex-1 overflow-y-auto", children: matches.map((match) => (_jsxs("div", { className: "flex items-center gap-4 p-4 border-b", children: [_jsx("div", { className: "w-14 h-14 rounded-full bg-gray-200 bg-cover bg-center flex-shrink-0", style: match.user.photos[0] ? { backgroundImage: `url(${match.user.photos[0]})` } : {} }), _jsx("div", { className: "flex-1 min-w-0", children: _jsx("p", { className: "font-semibold", children: match.user.name }) }), _jsx("a", { href: `tg://user?id=${match.user.telegramId}`, className: "px-4 py-2 rounded-xl text-sm font-semibold", style: { background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }, children: t.matches.message })] }, match.id))) })] }));
}
