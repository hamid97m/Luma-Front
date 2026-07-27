import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useRawInitData } from '@telegram-apps/sdk-react';
import { api } from './api.js';
import { useAuthStore } from './store.js';
export function App() {
    const initDataRaw = useRawInitData();
    const { setUser, setInitDataRaw } = useAuthStore();
    const [screen, setScreen] = useState('loading');
    useEffect(() => {
        if (!initDataRaw)
            return;
        setInitDataRaw(initDataRaw);
        window.Telegram?.WebApp?.expand?.();
        api.auth.verify(initDataRaw)
            .then(async ({ user: partialUser }) => {
            if (partialUser.setupComplete) {
                const fullProfile = await api.profile.get();
                setUser(fullProfile);
                setScreen('main');
            }
            else {
                setScreen('onboarding');
            }
        })
            .catch(() => setScreen('onboarding'));
    }, [initDataRaw]);
    if (screen === 'loading') {
        return (_jsx("div", { className: "flex items-center justify-center h-screen", children: _jsx("div", { className: "animate-pulse text-2xl", children: "\uD83D\uDC98" }) }));
    }
    // Screens plugged in by subsequent tasks
    return _jsx("div", { children: "\u062F\u0631 \u062D\u0627\u0644 \u0633\u0627\u062E\u062A..." });
}
