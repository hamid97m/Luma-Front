import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { t } from '../i18n.js';
const TABS = [
    { id: 'discovery', icon: '🔥', label: t.nav.discovery },
    { id: 'matches', icon: '💬', label: t.nav.matches },
    { id: 'profile', icon: '👤', label: t.nav.profile },
];
export function BottomNav({ active, onChange }) {
    return (_jsx("nav", { className: "flex border-t bg-white", style: { background: 'var(--tg-theme-bg-color)' }, children: TABS.map((tab) => (_jsxs("button", { onClick: () => onChange(tab.id), className: `flex-1 flex flex-col items-center py-3 gap-1 text-xs font-medium transition-colors ${active === tab.id ? 'opacity-100' : 'opacity-40'}`, style: active === tab.id ? { color: 'var(--tg-theme-button-color)' } : {}, children: [_jsx("span", { className: "text-xl", children: tab.icon }), tab.label] }, tab.id))) }));
}
