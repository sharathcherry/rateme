import { expect, test, describe } from 'vitest';

function formatTimeAgo(timestamp: any) {
  if (!timestamp) return '';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}y ago`;
}

describe('Time Formatter tests', () => {
  test('Correctly formats exactly now seconds', () => {
    const fakeFirebaseTimestamp = {
      toDate: () => new Date(Date.now() - 5 * 1000) 
    };
    expect(formatTimeAgo(fakeFirebaseTimestamp)).toBe('Just now');
  });

  test('Correctly formats hours ago', () => {
    const fakeFirebaseTimestamp = {
      toDate: () => new Date(Date.now() - 3600 * 5 * 1000) 
    };
    expect(formatTimeAgo(fakeFirebaseTimestamp)).toBe('5h ago');
  });
  
  test('Correctly falls back to JS dates', () => {
    expect(formatTimeAgo(Date.now() - 86400 * 2 * 1000)).toBe('2d ago');
  });
});
