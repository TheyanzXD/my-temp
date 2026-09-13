import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

export function formatTimeAgo(isoString: string): string {
	if (!isoString) return '';
	const date = new Date(isoString);
	const now = new Date();
	const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

	if (diffInSeconds < 10) return 'just now';
	if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

	const diffInMinutes = Math.floor(diffInSeconds / 60);
	if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

	const diffInHours = Math.floor(diffInMinutes / 60);
	if (diffInHours < 24) return `${diffInHours}h ago`;

	const diffInDays = Math.floor(diffInHours / 24);
	return `${diffInDays}d ago`;
}

export function formatExactDate(isoString: string): string {
	if (!isoString) return '';
	const date = new Date(isoString);
	return date.toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

export function formatCountdown(expiresAtIso: string): { text: string; isExpired: boolean; percent: number } {
	if (!expiresAtIso) return { text: '00:00', isExpired: true, percent: 0 };

	const expireTime = new Date(expiresAtIso).getTime();
	const now = Date.now();
	const diffMs = expireTime - now;

	if (diffMs <= 0) {
		return { text: '00:00', isExpired: true, percent: 0 };
	}

	const totalMs = 60 * 60 * 1000;
	const percent = Math.min(100, Math.max(0, (diffMs / totalMs) * 100));

	const totalSeconds = Math.floor(diffMs / 1000);
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	const formattedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
	const formattedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;

	return {
		text: `${formattedMinutes}:${formattedSeconds}`,
		isExpired: false,
		percent
	};
}
