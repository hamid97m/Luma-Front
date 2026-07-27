import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useRawInitData } from '@telegram-apps/sdk-react';
import { api } from './api.js';
import { useAuthStore } from './store.js';
import { Onboarding } from './screens/Onboarding.js';
import { ProfileSetup } from './screens/ProfileSetup.js';
import { Discovery } from './screens/Discovery.js';
import { Matches } from './screens/Matches.js';
import { MyProfile } from './screens/MyProfile.js';
import { BottomNav } from './components/BottomNav.js';
export function App() {
    const initDataRaw = useRawInitData();
    const { user, setUser, setInitDataRaw } = useAuthStore();
    const [screen, setScreen] = useState('loading');
    const [tab, setTab] = useState('discovery');
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
    if (screen === 'onboarding') {
        return _jsx(Onboarding, { onStart: () => setScreen('setup') });
    }
    if (screen === 'setup') {
        return (_jsx(ProfileSetup, { onComplete: async () => {
                const profile = await api.profile.get();
                setUser(profile);
                setScreen('main');
            } }));
    }
    return (_jsxs("div", { className: "flex flex-col h-screen", children: [_jsxs("div", { className: "flex-1 overflow-hidden", children: [tab === 'discovery' && _jsx(Discovery, {}), tab === 'matches' && _jsx(Matches, {}), tab === 'profile' && _jsx(MyProfile, {})] }), _jsx(BottomNav, { active: tab, onChange: setTab })] }));
}
