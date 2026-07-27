import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProfileSetup } from '../src/screens/ProfileSetup.js';
import { api } from '../src/api.js';
vi.mock('../src/api.js', () => ({
    api: {
        auth: { verify: vi.fn() },
        profile: { get: vi.fn(), update: vi.fn() },
        photos: { getUploadUrl: vi.fn(), delete: vi.fn(), reorder: vi.fn(), uploadFile: vi.fn() },
        discovery: { feed: vi.fn() },
        swipes: { swipe: vi.fn() },
        matches: { list: vi.fn() },
    },
}));
describe('ProfileSetup', () => {
    it('shows age step after name step', async () => {
        vi.mocked(api.profile.update).mockResolvedValue({});
        render(_jsx(ProfileSetup, { onComplete: vi.fn() }));
        expect(screen.getByText(/چند سالته/i)).toBeInTheDocument();
    });
    it('calls api.profile.update on final step', async () => {
        vi.mocked(api.profile.update).mockResolvedValue({});
        const onComplete = vi.fn();
        render(_jsx(ProfileSetup, { onComplete: onComplete }));
        // Fill age
        fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '25' } });
        fireEvent.click(screen.getByText(/بعدی/));
        // Select gender
        fireEvent.click(screen.getByText(/مرد/));
        fireEvent.click(screen.getByText(/بعدی/));
        // Select looking for
        fireEvent.click(screen.getByText(/خانم/));
        fireEvent.click(screen.getByText(/بعدی/));
        // Skip photos
        fireEvent.click(screen.getByText(/رد کن/));
        // Skip bio and finish
        fireEvent.click(screen.getByText(/بریم/));
        await waitFor(() => {
            expect(api.profile.update).toHaveBeenCalledWith(expect.objectContaining({ age: 25, gender: 'man', looking_for: 'women' }));
        });
    });
});
